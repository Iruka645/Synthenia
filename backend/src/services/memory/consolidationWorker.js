const { query, pool } = require('../../db/pool');
const embeddingService = require('./embeddingService');
const { Ollama } = require('ollama');
require('dotenv').config();

const AI_MODEL = process.env.AI_MODEL;

// สร้าง Ollama client พร้อม timeout สำหรับ consolidation tasks
// (extractFacts + checkContradiction + reflectiveSummary ล้วนใช้เวลาประมวลผลนาน)
const CONSOLIDATION_TIMEOUT_MS = 5 * 60_000; // 5 นาที
const ollamaClient = new Ollama({
  host: `${process.env.Ollama_BaseURL || 'http://localhost'}:${process.env.Ollama_Port || 11434}`,
  fetch: (url, options) => {
    const signal = AbortSignal.timeout(CONSOLIDATION_TIMEOUT_MS);
    return fetch(url, { ...options, signal });
  },
});

class ConsolidationWorker {
  constructor() {
    this._isRunning = false;
  }

  async runConsolidation() {
    if (this._isRunning) {
      console.log('[Memory Consolidation] Already running, skip this trigger.');
      return { skipped: true };
    }
    this._isRunning = true;

    console.log('[Memory Consolidation] Starting consolidation job...');
    const client = await pool.connect();
    let sessions = [];
    try {
      await client.query('BEGIN');
      
      // Select ended sessions using FOR UPDATE SKIP LOCKED
      const sessionsResult = await client.query(
        `SELECT id, message_count FROM sessions
         WHERE consolidated = FALSE AND ended_at IS NOT NULL AND message_count >= 4
         ORDER BY id ASC
         LIMIT 20
         FOR UPDATE SKIP LOCKED`
      );

      sessions = sessionsResult.rows;
      console.log(`[Memory Consolidation] Locked ${sessions.length} sessions to consolidate.`);

      if (sessions.length === 0) {
        await client.query('COMMIT');
        return { consolidatedCount: 0 };
      }

      // Pre-mark locked sessions as consolidated within transaction to release locks quickly
      const sessionIds = sessions.map(s => s.id);
      await client.query(
        `UPDATE sessions SET consolidated = TRUE WHERE id = ANY($1::int[])`,
        [sessionIds]
      );

      await client.query('COMMIT');
    } catch (dbErr) {
      console.error('[Memory Consolidation] Database transaction error:', dbErr);
      try {
        await client.query('ROLLBACK');
      } catch (rErr) {
        // ignore
      }
      this._isRunning = false;
      client.release();
      return;
    } finally {
      client.release();
    }

    // Process sessions outside of transaction to avoid holding locks during long LLM calls
    for (const session of sessions) {
      console.log(`[Memory Consolidation] Consolidating session ${session.id}...`);
      let success = false;
      try {
        const msgResult = await query(
          `SELECT role, content FROM messages
           WHERE session_id = $1
           ORDER BY id ASC`,
          [session.id]
        );

        const messages = msgResult.rows;
        if (messages.length > 0) {
          // Extract facts using Ollama
          const extractResult = await this.extractFactsWithLLM(messages);
          
          if (!extractResult.success) {
            console.warn(`[Memory Consolidation] Session ${session.id} skipped: extraction failed. Reverting consolidated flag to retry.`);
            await query(`UPDATE sessions SET consolidated = FALSE WHERE id = $1`, [session.id]);
            continue;
          }

          const rawFacts = extractResult.facts || [];
          console.log(`[Memory Consolidation] Extracted ${rawFacts.length} raw facts from session ${session.id}.`);

          // Validate and normalize facts
          const validFacts = [];
          for (const fact of rawFacts) {
            await this.recordValidationMetric('processed');
            const valResult = await this.validateFact(fact, session.id);
            if (valResult.valid) {
              validFacts.push(valResult.normalizedFact);
            } else {
              await this.recordValidationMetric('failure', valResult.reason);
              await this.logValidationFailure(session.id, valResult.reason, fact);
            }
          }

          // Upsert each validated fact
          for (const fact of validFacts) {
            await this.upsertSemanticFact(fact, session.id);
          }
        }
        success = true;
        console.log(`[Memory Consolidation] Session ${session.id} consolidated successfully.`);
      } catch (sessionErr) {
        console.error(`[Memory Consolidation] Failed to process session ${session.id}:`, sessionErr);
        // Revert consolidated flag to retry on next run
        try {
          await query(`UPDATE sessions SET consolidated = FALSE WHERE id = $1`, [session.id]);
        } catch (dbUpdateErr) {
          console.error(`[Memory Consolidation] Failed to revert consolidated status for session ${session.id}:`, dbUpdateErr);
        }
      }
    }

    try {
      if (sessions.length > 0) {
        await this.generateReflectiveSummary();
      }
      console.log('[Memory Consolidation] Consolidation job complete!');
    } catch (summaryErr) {
      console.error('[Memory Consolidation] Error generating reflective summary:', summaryErr);
    } finally {
      this._isRunning = false;
    }
  }

  async extractFactsWithLLM(messages) {
    // Format conversation history for prompt
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Ken' : 'Syn'}: ${m.content}`)
      .join('\n');

    const prompt = `คุณคือระบบวิเคราะห์ความทรงจำของ AI VTuber ชื่อ "ซิน"
อ่านบทสนทนาระหว่าง Ken (พ่อ/ผู้ใช้) และ Syn (ซิน/ลูกสาว) ด้านล่างนี้ แล้วสรุปข้อมูลเป็น "ข้อเท็จจริง (facts)" สำคัญที่ซินควรจำไว้ใช้ในอนาคต

กฎการสรุป:
1. สรุปเฉพาะข้อมูลสำคัญที่เป็นข้อเท็จจริงจริงจัง เช่น ความชอบ, ชื่อคน, เหตุการณ์สำคัญ, นิสัย, คำพูดเล่นประจำตัว (running joke)
2. ห้ามสรุปเรื่องทั่วไปที่ไร้ประโยชน์ หรือทักทายเฉยๆ
3. เขียน fact สั้นๆ ตรงไปตรงมาเป็นภาษาไทย เช่น "Ken ชอบบ่นเรื่องปวดหลัง" หรือ "Ken ซื้อโมเดล Live2D ให้ซิน"
4. แยกตาม category:
   - 'preference' (ความชอบ/ความเกลียดของ Ken)
   - 'event' (เหตุการณ์สำคัญที่เพิ่งเกิดขึ้นหรือคุยกัน)
   - 'relationship' (เรื่องเกี่ยวกับความสัมพันธ์พ่อลูก หรือครอบครัว)
   - 'trait' (ลักษณะนิสัยของ Ken หรือพฤติกรรม)
   - 'running_joke' (มุกตลกประจำตัว หรือคำพูดแกล้งกันบ่อยๆ)

บทสนทนา:
${conversationText}
`;

    try {
      const response = await ollamaClient.chat({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        format: {
          type: "object",
          properties: {
            facts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  category: { type: "string", enum: ["preference", "event", "relationship", "trait", "running_joke"] },
                  importance: { type: "number", minimum: 0.0, maximum: 1.0 }
                },
                required: ["text", "category", "importance"]
              }
            }
          },
          required: ["facts"]
        },
        options: {
          temperature: 0.2
        }
      });

      let content = response.message.content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?([\s\S]*?)```/);
        if (match) {
          content = match[1];
        }
      }

      const parsed = JSON.parse(content.trim());
      return { success: true, facts: parsed.facts || [] };
    } catch (err) {
      console.error('[Memory Consolidation] Error extracting facts with LLM:', err.message);
      return { success: false, error: err.message };
    }
  }

  async validateFact(fact, sessionId) {
    if (!fact || typeof fact !== 'object') {
      return { valid: false, reason: 'invalid_fact_format' };
    }
    if (!fact.text || typeof fact.text !== 'string' || !fact.text.trim()) {
      return { valid: false, reason: 'missing_text' };
    }
    if (!fact.category || typeof fact.category !== 'string') {
      return { valid: false, reason: 'missing_category' };
    }
    if (fact.importance === undefined || fact.importance === null || typeof fact.importance !== 'number') {
      return { valid: false, reason: 'missing_importance' };
    }

    const textCleaned = fact.text.trim();
    if (textCleaned.length < 3) {
      return { valid: false, reason: 'text_too_short' };
    }

    const lowValueWords = ['ครับ', 'ค่ะ', 'นะ', 'นะรับ', 'คับ', 'โอเค', 'ok', 'สวัสดี', 'ทักทาย'];
    if (lowValueWords.includes(textCleaned.toLowerCase())) {
      return { valid: false, reason: 'low_value_content' };
    }

    const allowedCategories = ["preference", "event", "relationship", "trait", "running_joke"];
    let categoryNormalized = fact.category.trim();
    let warnings = [];
    if (!allowedCategories.includes(categoryNormalized)) {
      warnings.push(`unknown_category_${categoryNormalized}`);
      categoryNormalized = 'event';
    }

    const CATEGORY_TO_MEMORY_TYPE = {
      preference:   'preference',
      event:        'episode',
      relationship: 'relationship',
      trait:        'personality',
      running_joke: 'episode',
    };
    const memoryType = CATEGORY_TO_MEMORY_TYPE[categoryNormalized] || 'episode';

    let importanceClamped = fact.importance;
    let clampImportance = false;
    if (importanceClamped < 0.0) {
      importanceClamped = 0.0;
      clampImportance = true;
    } else if (importanceClamped > 1.0) {
      importanceClamped = 1.0;
      clampImportance = true;
    }

    let confidenceClamped = fact.confidence !== undefined && fact.confidence !== null ? fact.confidence : 1.0;
    let clampConfidence = false;
    if (confidenceClamped < 0.0) {
      confidenceClamped = 0.0;
      clampConfidence = true;
    } else if (confidenceClamped > 1.0) {
      confidenceClamped = 1.0;
      clampConfidence = true;
    }

    if (clampImportance || clampConfidence) {
      try {
        const configService = require('../config/configService');
        const currentMetrics = await configService.get('metrics:memory_validation', {
          total_facts_processed: 0,
          importance_clamps: 0,
          confidence_clamps: 0,
          validation_failures: {}
        });

        if (clampImportance) currentMetrics.importance_clamps = (currentMetrics.importance_clamps || 0) + 1;
        if (clampConfidence) currentMetrics.confidence_clamps = (currentMetrics.confidence_clamps || 0) + 1;

        await configService.set('metrics:memory_validation', currentMetrics);
      } catch (metricErr) {
        console.error('[Memory Validation] Failed to update clamp metrics:', metricErr.message);
      }
    }

    // Duplicate check
    try {
      const duplicateResult = await query(
        `SELECT id FROM semantic_facts WHERE fact_text = $1 AND superseded_by IS NULL LIMIT 1`,
        [textCleaned]
      );
      if (duplicateResult.rows.length > 0) {
        return { valid: false, reason: 'exact_duplicate_text' };
      }
    } catch (dbErr) {
      console.error('[Memory Validation] Duplicate check query error:', dbErr.message);
    }

    return {
      valid: true,
      warnings,
      normalizedFact: {
        text: textCleaned,
        category: categoryNormalized,
        memoryType,
        importance: importanceClamped,
        confidence: confidenceClamped
      }
    };
  }

  async recordValidationMetric(metricType, key = null) {
    try {
      const configService = require('../config/configService');
      const currentMetrics = await configService.get('metrics:memory_validation', {
        total_facts_processed: 0,
        importance_clamps: 0,
        confidence_clamps: 0,
        validation_failures: {}
      });

      if (metricType === 'processed') {
        currentMetrics.total_facts_processed = (currentMetrics.total_facts_processed || 0) + 1;
      } else if (metricType === 'failure' && key) {
        if (!currentMetrics.validation_failures) currentMetrics.validation_failures = {};
        currentMetrics.validation_failures[key] = (currentMetrics.validation_failures[key] || 0) + 1;
      }

      await configService.set('metrics:memory_validation', currentMetrics);
    } catch (err) {
      console.error('[Memory Validation] Failed to update validation metrics:', err.message);
    }
  }

  async logValidationFailure(sessionId, reason, originalFact) {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '../../logs');
    const logFilePath = path.join(logsDir, 'memory_validation_audit.log');

    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        sessionId,
        reason,
        originalFact
      };

      fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n', 'utf8');
      console.warn(`[Memory Validation Audit] Fact failed validation. Session ID: ${sessionId}, Reason: ${reason}, Fact: ${JSON.stringify(originalFact)}`);
    } catch (err) {
      console.error('[Memory Validation] Failed to write validation audit log:', err.message);
    }
  }

  async upsertSemanticFact(fact, sessionId) {
    try {
      let embedding;
      try {
        embedding = await embeddingService.getEmbedding(fact.text);
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 1024) {
          throw new Error(`Embedding generated is null or length is ${embedding?.length || 0}`);
        }
      } catch (embedErr) {
        console.error(`[Memory Consolidation] Embedding generation failed for fact: "${fact.text}". Error: ${embedErr.message}`);
        await this.recordValidationMetric('failure', 'embedding_failed');
        throw embedErr;
      }

      const embeddingStr = JSON.stringify(embedding);

      // Find similar active facts (superseded_by IS NULL) with cosine similarity >= 0.85 (distance <= 0.15)
      const similarResult = await query(
        `SELECT id, fact_text, memory_type, importance_score, confidence
         FROM semantic_facts
         WHERE superseded_by IS NULL AND (embedding <=> $1::vector) <= 0.15
         LIMIT 1`,
        [embeddingStr]
      );

      if (similarResult.rows.length === 0) {
        // No similar fact, insert as new
        const finalImportance = fact.memoryType === 'identity' ? 1.0 : fact.importance;

        await query(
          `INSERT INTO semantic_facts (fact_text, category, memory_type, embedding, importance_score, source_session_id, confidence)
           VALUES ($1, $2, $3, $4::vector, $5, $6, $7)`,
          [fact.text, fact.category, fact.memoryType, embeddingStr, finalImportance, sessionId, fact.confidence]
        );
        console.log(`[Memory Consolidation] Inserted new fact: "${fact.text}" (${fact.memoryType})`);
      } else {
        const existingFact = similarResult.rows[0];
        
        const highChangeTypes = ['identity', 'relationship', 'schedule'];
        const isHighChangeType = highChangeTypes.includes(fact.memoryType) || highChangeTypes.includes(existingFact.memory_type);

        let contradicts = false;
        if (isHighChangeType) {
          console.log(`[Memory Consolidation] Forcing LLM contradiction check (high-change type) for: "${existingFact.fact_text}" vs "${fact.text}"`);
          contradicts = await this.checkContradictionWithLLM(existingFact.fact_text, fact.text);
        } else if (this.hasContradictionKeywords(existingFact.fact_text) || this.hasContradictionKeywords(fact.text)) {
          contradicts = await this.checkContradictionWithLLM(existingFact.fact_text, fact.text);
        } else {
          console.log(`[Memory Consolidation] Skipping LLM contradiction check (no negation keywords and not high-change type) for: "${existingFact.fact_text}" vs "${fact.text}"`);
        }

        if (contradicts) {
          // Contradiction! Supersede the old one and insert the new one
          const finalImportance = fact.memoryType === 'identity' ? 1.0 : fact.importance;

          const insertResult = await query(
            `INSERT INTO semantic_facts (fact_text, category, memory_type, embedding, importance_score, source_session_id, confidence)
             VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
             RETURNING id`,
            [fact.text, fact.category, fact.memoryType, embeddingStr, finalImportance, sessionId, fact.confidence]
          );
          const newId = insertResult.rows[0].id;

          const currentExistingConfidence = parseFloat(existingFact.confidence !== null && existingFact.confidence !== undefined ? existingFact.confidence : 1.0);
          const reducedConfidence = Math.max(0.0, currentExistingConfidence - 0.2);

          await query(
            `UPDATE semantic_facts
             SET superseded_by = $1,
                 confidence = $2
             WHERE id = $3`,
            [newId, reducedConfidence, existingFact.id]
          );
          console.log(`[Memory Consolidation] Contradiction found. Superseded fact "${existingFact.fact_text}" with "${fact.text}" and reduced old fact confidence to ${reducedConfidence}`);
        } else {
          // No contradiction, bump the importance score slightly (+0.05) up to 1.0
          const currentImportance = parseFloat(existingFact.importance_score || 0.5);
          const newImportance = existingFact.memory_type === 'identity' ? 1.0 : Math.min(1.0, currentImportance + 0.05);

          const currentConfidence = parseFloat(existingFact.confidence !== null && existingFact.confidence !== undefined ? existingFact.confidence : 1.0);
          const newConfidence = Math.min(1.0, currentConfidence + 0.05);

          await query(
            `UPDATE semantic_facts
             SET importance_score = $1,
                 confidence = $2,
                 last_accessed_at = NOW()
             WHERE id = $3`,
            [newImportance, newConfidence, existingFact.id]
          );
          console.log(`[Memory Consolidation] Fact matches existing one. Bumped importance to ${newImportance} and confidence to ${newConfidence} for "${existingFact.fact_text}"`);
        }
      }
    } catch (err) {
      console.error('[Memory Consolidation] Error upserting fact:', err.message);
      throw err; // re-throw to allow session retry
    }
  }

  hasContradictionKeywords(text) {
    if (!text) return false;
    const keywords = [
      'ไม่', 'เกลียด', 'เลิก', 'ไม่ใช่', 'แต่', 'เปลี่ยน', 'งด', 'ห้าม', 'ตรงข้าม', 'ปฏิเสธ', 'แทนที่จะ',
      'ย้าย', 'ปัจจุบัน', 'ตอนนี้', 'ล่าสุด', 'กลายเป็น', 'ไม่ได้'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  async checkContradictionWithLLM(oldFact, newFact) {
    const prompt = `เปรียบเทียบข้อความสองข้อความด้านล่างนี้ ว่ามีความ "ขัดแย้งขัดล้างกันเองโดยตรง" หรือไม่?
เช่น "Ken ชอบกินชาไข่มุก" กับ "Ken เกลียดชาไข่มุก" -> ขัดแย้งกัน (contradicts = true)
เช่น "Ken ชอบหมา" กับ "Ken ซื้อหมามาเลี้ยง" -> ไม่ขัดแย้ง (contradicts = false)
เช่น "Ken เปลี่ยนมาทำงานเป็นโปรแกรมเมอร์" กับ "Ken เคยทำงานเป็นสถาปนิก" -> ไม่ขัดแย้ง (เป็นเหตุการณ์ต่างเวลากัน) (contradicts = false)

ข้อความ A (เก่า): "${oldFact}"
ข้อความ B (ใหม่): "${newFact}"
`;

    try {
      const response = await ollamaClient.chat({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        format: {
          type: "object",
          properties: {
            contradicts: { type: "boolean" }
          },
          required: ["contradicts"]
        },
        options: {
          temperature: 0.1
        }
      });

      let content = response.message.content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?([\s\S]*?)```/);
        if (match) {
          content = match[1];
        }
      }

      const parsed = JSON.parse(content.trim());
      return !!parsed.contradicts;
    } catch (err) {
      console.error('[Memory Consolidation] Error checking contradiction:', err.message);
      return false;
    }
  }

  async generateReflectiveSummary() {
    console.log('[Memory Consolidation] Generating Reflective Summary...');
    try {
      // 1. Get all active facts
      const factsResult = await query(
        `SELECT fact_text, category FROM semantic_facts
         WHERE superseded_by IS NULL
         ORDER BY importance_score DESC
         LIMIT 50`
      );

      const facts = factsResult.rows;
      if (facts.length === 0) return;

      const factsText = facts.map(f => `- [${f.category}] ${f.fact_text}`).join('\n');

      const prompt = `จากข้อเท็จจริงสำคัญในความทรงจำของ AI VTuber "ซิน" ด้านล่างนี้:
${factsText}

รบกวนสรุป "ภาพรวมความสัมพันธ์ระหว่างเคน (Ken) กับซิน (Syn)" รวมถึงบุคลิก ความชอบ และเรื่องตลกประจำตัวเป็นข้อความสั้นๆ 3-4 ประโยค เพื่อให้ซินนำไปประยุกต์ใช้ในการพูดคุยกับเคนได้อย่างเป็นธรรมชาติ สอดคล้องกับตัวตนของเธอ (วัยรุ่น ขี้เล่น ปากแข็งแต่เป็นห่วงพ่อ)`;

      const response = await ollamaClient.chat({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: 0.5
        }
      });

      const summaryText = response.message.content.trim();

      // Get latest version
      const versionResult = await query(
        `SELECT COALESCE(MAX(version), 0) AS max_ver FROM reflective_summary`
      );
      const newVersion = parseInt(versionResult.rows[0].max_ver || '0', 10) + 1;

      // Save summary
      await query(
        `INSERT INTO reflective_summary (summary_text, version, created_at)
         VALUES ($1, $2, NOW())`,
        [summaryText, newVersion]
      );
      console.log(`[Memory Consolidation] Reflective Summary version ${newVersion} created.`);
    } catch (err) {
      console.error('[Memory Consolidation] Error generating reflective summary:', err.message);
    }
  }
}

module.exports = new ConsolidationWorker();

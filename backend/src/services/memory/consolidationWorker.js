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
          const facts = await this.extractFactsWithLLM(messages);
          console.log(`[Memory Consolidation] Extracted ${facts.length} facts from session ${session.id}.`);

          // If extract failed (0 facts returned from >= 4 messages), revert status to retry
          if (facts.length === 0 && messages.length >= 4) {
            console.warn(`[Memory Consolidation] Session ${session.id} skipped: 0 facts extracted. Reverting consolidated flag to retry.`);
            await query(`UPDATE sessions SET consolidated = FALSE WHERE id = $1`, [session.id]);
            continue;
          }

          // Upsert each fact
          for (const fact of facts) {
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
      return parsed.facts || [];
    } catch (err) {
      console.error('[Memory Consolidation] Error extracting facts with LLM:', err.message);
      return [];
    }
  }

  async upsertSemanticFact(fact, sessionId) {
    try {
      const embedding = await embeddingService.getEmbedding(fact.text);
      const embeddingStr = JSON.stringify(embedding);

      // Find similar active facts (superseded_by IS NULL) with cosine similarity >= 0.85 (distance <= 0.15)
      const similarResult = await query(
        `SELECT id, fact_text, importance_score
         FROM semantic_facts
         WHERE superseded_by IS NULL AND (embedding <=> $1::vector) <= 0.15
         LIMIT 1`,
        [embeddingStr]
      );

      if (similarResult.rows.length === 0) {
        // No similar fact, insert as new
        await query(
          `INSERT INTO semantic_facts (fact_text, category, embedding, importance_score, source_session_id, confidence)
           VALUES ($1, $2, $3::vector, $4, $5, 1.0)`,
          [fact.text, fact.category, embeddingStr, fact.importance, sessionId]
        );
        console.log(`[Memory Consolidation] Inserted new fact: "${fact.text}"`);
      } else {
        const existingFact = similarResult.rows[0];
        
        // Check for contradiction (skip LLM check if no contradiction/negation keywords exist in either fact)
        let contradicts = false;
        if (this.hasContradictionKeywords(existingFact.fact_text) || this.hasContradictionKeywords(fact.text)) {
          contradicts = await this.checkContradictionWithLLM(existingFact.fact_text, fact.text);
        } else {
          console.log(`[Memory Consolidation] Skipping LLM contradiction check (no negation keywords) for: "${existingFact.fact_text}" vs "${fact.text}"`);
        }

        if (contradicts) {
          // Contradiction! Supersede the old one and insert the new one
          const insertResult = await query(
            `INSERT INTO semantic_facts (fact_text, category, embedding, importance_score, source_session_id, confidence)
             VALUES ($1, $2, $3::vector, $4, $5, 1.0)
             RETURNING id`,
            [fact.text, fact.category, embeddingStr, fact.importance, sessionId]
          );
          const newId = insertResult.rows[0].id;

          await query(
            `UPDATE semantic_facts
             SET superseded_by = $1
             WHERE id = $2`,
            [newId, existingFact.id]
          );
          console.log(`[Memory Consolidation] Contradiction found. Superseded fact "${existingFact.fact_text}" with "${fact.text}"`);
        } else {
          // No contradiction, bump the importance score slightly (+0.05) up to 1.0
          const currentImportance = parseFloat(existingFact.importance_score || 0.5);
          const newImportance = Math.min(1.0, currentImportance + 0.05);

          await query(
            `UPDATE semantic_facts
             SET importance_score = $1,
                 last_accessed_at = NOW()
             WHERE id = $2`,
            [newImportance, existingFact.id]
          );
          console.log(`[Memory Consolidation] Fact matches existing one. Bumped importance of "${existingFact.fact_text}" to ${newImportance}`);
        }
      }
    } catch (err) {
      console.error('[Memory Consolidation] Error upserting fact:', err.message);
    }
  }

  hasContradictionKeywords(text) {
    if (!text) return false;
    const keywords = ['ไม่', 'เกลียด', 'เลิก', 'ไม่ใช่', 'แต่', 'เปลี่ยน', 'งด', 'ห้าม', 'ตรงข้าม', 'ปฏิเสธ', 'แทนที่จะ'];
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

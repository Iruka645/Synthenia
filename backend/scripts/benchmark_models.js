/**
 * backend/scripts/benchmark_models.js
 *
 * เปรียบเทียบหลายโมเดล Ollama โดยรัน CHARACTER_BENCHMARK ทั้งหมด
 * ผ่าน system prompt เต็มของแอปจริง (identity+personality+speech_style+json_schema)
 * แล้วเก็บ:
 *   - ความเร็ว (prompt eval rate / eval rate / total duration)
 *   - ผลเช็คอัตโนมัติที่ทำได้จริง (JSON ถูกต้อง, emotion อยู่ใน allowedEmotions,
 *     ไม่มี markdown/emoji/bullet, ความยาวประโยคอยู่ใน 1-3, ไม่มีคำลงท้ายเพศชาย "ครับ")
 *   - รายการที่ต้องตรวจด้วยตา (expectedSignals / forbiddenSignals เชิงความหมาย)
 *
 * วิธีใช้:
 *   node backend/scripts/benchmark_models.js scb10x/llama3.2-typhoon2-3b-instruct scb10x/typhoon2.5-qwen3-4b
 *
 *   ไม่ใส่ argument จะรันกับโมเดลเดียวจาก .env (AI_MODEL)
 *
 * ผลลัพธ์:
 *   - print สรุปเป็นตารางใน console
 *   - เขียนไฟล์ผลละเอียดเป็น JSON ที่ backend/logs/benchmark_<timestamp>.json
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Ollama } = require('ollama');
const { CHARACTER_BENCHMARK } = require('../src/prompts/character_benchmark');
const { buildSystemPrompt } = require('../src/prompts/system_builder');

const Ollama_BASE_URL = process.env.Ollama_BaseURL || 'http://localhost';
const Ollama_PORT = process.env.Ollama_Port || 11434;
const BENCH_TIMEOUT_MS = 5 * 60_000; // 5 นาที ต่อ 1 เคส กันเคส 8B/12B ที่ช้ามากค้าง

// num_predict ใช้ค่าเดียวกับ production (config/personality.js) เว้นแต่ override ผ่าน env
const NUM_PREDICT = parseInt(process.env.BENCH_NUM_PREDICT, 10) || 150;
const TEMPERATURE = parseFloat(process.env.BENCH_TEMPERATURE) || 0.7;
const TOP_P = parseFloat(process.env.BENCH_TOP_P) || 0.9;
const BENCH_RUNS = parseInt(process.env.BENCH_RUNS, 10) || 3;

const client = new Ollama({
  host: `${Ollama_BASE_URL}:${Ollama_PORT}`,
  fetch: (url, opts) => {
    const signal = AbortSignal.timeout(BENCH_TIMEOUT_MS);
    return fetch(url, { ...opts, signal });
  },
});

const ALL_EMOTIONS = ['neutral', 'happy', 'laugh', 'embarrassed', 'annoyed', 'sad', 'thinking', 'surprised'];

// map forbiddenSignals บางคำที่เช็คอัตโนมัติได้จริง -> ฟังก์ชันเช็ค
// ที่เหลือ (เช่น "ด่า", "ประชดแรง", "เดาข้อมูล") ต้องตรวจด้วยตา เพราะเป็นเชิงความหมาย
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const MARKDOWN_REGEX = /(\*\*|##|^\s*[-*]\s|^\s*\d+\.\s|```)/m;
const MALE_PARTICLE_REGEX = /ครับ/;
const META_LEAK_REGEX = /(system\s*prompt|system_prompt|memory\s*context|json\s*schema|personality|speech\s*style|assistant|ollama|prompt|system\s*message|user\s*message|บุคลิกที่กำหนด)/i;
const PLACEHOLDER_REGEX = /\[.*?\]|\{.*?\}/;

function countSentences(text) {
  // heuristic: แบ่งด้วย . ! ? หรือ newline ของภาษาไทย/อังกฤษปนกัน
  const cleaned = text.trim();
  if (!cleaned) return 0;
  const parts = cleaned.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  return parts.length || 1;
}

function autoChecks(caseItem, parsed) {
  const { reply, emotion } = parsed;
  const checks = {
    validJson: true,
    emotionValid: ALL_EMOTIONS.includes(emotion),
    emotionAllowedForCase: caseItem.allowedEmotions.includes(emotion),
    hasMarkdown: MARKDOWN_REGEX.test(reply),
    hasEmoji: EMOJI_REGEX.test(reply),
    hasMaleParticle: MALE_PARTICLE_REGEX.test(reply), // Syn เป็นตัวละครหญิง ไม่ควรมี "ครับ"
    hasMetaLeak: META_LEAK_REGEX.test(reply),
    hasPlaceholder: PLACEHOLDER_REGEX.test(reply) || reply.replace(/\s/g, '').length < 3,
    sentenceCount: countSentences(reply),
    sentenceCountOk: null, // set below
  };
  checks.sentenceCountOk = checks.sentenceCount >= 1 && checks.sentenceCount <= 3;

  // เช็ค forbiddenSignals เท่าที่ map เป็นกฎอัตโนมัติได้
  const autoFlags = [];
  for (const sig of caseItem.forbiddenSignals) {
    if (sig.includes('อีโมจิ') && checks.hasEmoji) autoFlags.push(`forbidden matched: "${sig}"`);
    if (sig.toLowerCase().includes('markdown') && checks.hasMarkdown) autoFlags.push(`forbidden matched: "${sig}"`);
    if (sig.includes('bullet') && checks.hasMarkdown) autoFlags.push(`forbidden matched: "${sig}"`);
    if (sig.includes('ตอบยาว') && !checks.sentenceCountOk) autoFlags.push(`forbidden matched: "${sig}"`);
    if (sig.includes('ตอบเป็นข้อ') && checks.hasMarkdown) autoFlags.push(`forbidden matched: "${sig}"`);
  }

  if (checks.hasMetaLeak) autoFlags.push('meta-leak detected');
  if (checks.hasPlaceholder) autoFlags.push('placeholder or broken reply');

  const needsManualReview = caseItem.expectedSignals.length > 0 || caseItem.forbiddenSignals.some(
    sig => !['อีโมจิ', 'markdown', 'bullet list', 'ตอบยาว', 'ตอบเป็นข้อ'].some(k => sig.toLowerCase().includes(k.toLowerCase()))
  );

  return { checks, autoFlags, needsManualReview };
}

function parseModelReply(rawContent) {
  let content = rawContent.trim();
  if (content.includes('```')) {
    const match = content.match(/```(?:json)?([\s\S]*?)```/);
    if (match) content = match[1].trim();
  }
  const parsed = JSON.parse(content);
  if (!parsed.reply || !parsed.emotion) {
    throw new Error(`Missing reply/emotion fields: ${JSON.stringify(parsed)}`);
  }
  return { reply: String(parsed.reply).trim(), emotion: String(parsed.emotion).trim() };
}

async function runCase(model, systemPrompt, caseItem) {
  const start = Date.now();
  const response = await client.chat({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: caseItem.input },
    ],
    options: { temperature: TEMPERATURE, top_p: TOP_P, num_predict: NUM_PREDICT },
    stream: false,
    keep_alive: '10m',
    format: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        emotion: { type: 'string', enum: ALL_EMOTIONS },
      },
      required: ['reply', 'emotion'],
    },
  });
  const wallClockMs = Date.now() - start;

  const parsed = parseModelReply(response.message.content);
  const { checks, autoFlags, needsManualReview } = autoChecks(caseItem, parsed);

  const toSec = (ns) => (ns ? +(ns / 1e9).toFixed(2) : null);

  return {
    caseId: caseItem.id,
    input: caseItem.input,
    reply: parsed.reply,
    emotion: parsed.emotion,
    wallClockMs,
    stats: {
      totalDurationSec: toSec(response.total_duration),
      loadDurationSec: toSec(response.load_duration),
      promptEvalCount: response.prompt_eval_count ?? null,
      promptEvalRate: response.prompt_eval_duration
        ? +((response.prompt_eval_count / (response.prompt_eval_duration / 1e9)).toFixed(2))
        : null,
      evalCount: response.eval_count ?? null,
      evalRate: response.eval_duration
        ? +((response.eval_count / (response.eval_duration / 1e9)).toFixed(2))
        : null,
    },
    checks,
    autoFlags,
    needsManualReview,
  };
}

async function runModel(model) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`โมเดล: ${model}`);
  console.log('='.repeat(70));

  const systemPrompt = buildSystemPrompt({ memoryContext: '' });
  const cases = [];

  for (const caseItem of CHARACTER_BENCHMARK) {
    console.log(`  [${caseItem.id}] กำลังรัน (${BENCH_RUNS} รอบ)...`);
    const runs = [];
    for (let i = 1; i <= BENCH_RUNS; i++) {
      process.stdout.write(`    รอบที่ ${i}: `);
      try {
        const result = await runCase(model, systemPrompt, caseItem);
        runs.push({ run: i, ...result });

        const flagsText = result.autoFlags.length > 0 ? ` ⚠️ ${result.autoFlags.join(', ')}` : '';
        const maleFlag = result.checks.hasMaleParticle ? ' 🚨 มีคำว่า "ครับ" (ผิดเพศตัวละคร)' : '';
        console.log(
          `${result.stats.evalRate ?? '?'} tok/s | ${result.wallClockMs}ms | emotion=${result.emotion}${flagsText}${maleFlag}`
        );
      } catch (err) {
        console.log(`FAILED — ${err.message}`);
        runs.push({ run: i, error: err.message });
      }
    }
    cases.push({
      caseId: caseItem.id,
      input: caseItem.input,
      runs
    });
  }

  return { model, cases };
}

function printSummaryTable(allResults) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('สรุปเปรียบเทียบ (สถิติจากทุกรัน)');
  console.log('='.repeat(70));

  for (const { model, cases } of allResults) {
    const allRuns = cases.flatMap(c => c.runs);
    const ok = allRuns.filter(r => !r.error);
    const avgEval = ok.length
      ? (ok.reduce((s, r) => s + (r.stats?.evalRate || 0), 0) / ok.length).toFixed(2)
      : 'N/A';
    const avgWall = ok.length
      ? Math.round(ok.reduce((s, r) => s + (r.wallClockMs || 0), 0) / ok.length)
      : 'N/A';
    const maleParticleHits = ok.filter(r => r.checks?.hasMaleParticle).length;
    const autoFlagHits = ok.filter(r => r.autoFlags?.length > 0).length;
    const manualReviewCount = ok.filter(r => r.needsManualReview).length;
    const failed = allRuns.length - ok.length;

    console.log(`\n${model}`);
    console.log(`  avg eval rate:        ${avgEval} tok/s`);
    console.log(`  avg wall clock:       ${avgWall} ms`);
    console.log(`  เคสที่มีคำว่า "ครับ":   ${maleParticleHits}/${ok.length} รัน`);
    console.log(`  เคสที่โดน auto-flag:   ${autoFlagHits}/${ok.length} รัน`);
    console.log(`  เคสที่ต้องตรวจด้วยตา:   ${manualReviewCount}/${ok.length} รัน (expectedSignals เชิงความหมาย)`);
    if (failed > 0) console.log(`  ⚠️ รันไม่สำเร็จ:        ${failed}/${allRuns.length} รัน`);
  }

  console.log(`\nหมายเหตุ: expectedSignals/forbiddenSignals ส่วนใหญ่เป็นการเช็คเชิงความหมาย`);
  console.log(`(เช่น "เขิน", "ปากแข็ง", "ห่วงพ่อ") — สคริปต์นี้เช็คอัตโนมัติได้เฉพาะ`);
  console.log(`โครงสร้าง/รูปแบบเท่านั้น ส่วนที่เหลือต้องเปิดไฟล์ JSON หรือรายงาน Markdown ผลลัพธ์มาอ่านเทียบเองครับ`);
}

function escapeMarkdownTable(text) {
  if (!text) return '';
  return text
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateMarkdownReport(allResults, config) {
  const timestamp = new Date().toLocaleString('th-TH');
  let md = `# รายงานเปรียบเทียบประสิทธิภาพโมเดล (Benchmark Comparison Report)\n\n`;
  md += `**รันเมื่อ:** ${timestamp}\n\n`;
  md += `### การตั้งค่าการทดสอบ (Configuration)\n`;
  md += `- **BENCH_RUNS:** ${config.BENCH_RUNS} รอบต่อเคส\n`;
  md += `- **TEMPERATURE:** ${config.TEMPERATURE}\n`;
  md += `- **TOP_P:** ${config.TOP_P}\n`;
  md += `- **NUM_PREDICT:** ${config.NUM_PREDICT}\n\n`;

  md += `## 📊 สรุปผลประสิทธิภาพเฉลี่ย (Summary Stats)\n\n`;
  md += `| โมเดล (Model) | ความเร็วเฉลี่ย (Avg Speed) | เวลาตอบกลับเฉลี่ย (Avg Wall Clock) | คำว่า "ครับ" | Auto Flag | ต้องตรวจด้วยตา | รันไม่สำเร็จ |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const { model, cases } of allResults) {
    const allRuns = cases.flatMap(c => c.runs);
    const ok = allRuns.filter(r => !r.error);
    const avgEval = ok.length
      ? (ok.reduce((s, r) => s + (r.stats?.evalRate || 0), 0) / ok.length).toFixed(2)
      : 'N/A';
    const avgWall = ok.length
      ? Math.round(ok.reduce((s, r) => s + (r.wallClockMs || 0), 0) / ok.length)
      : 'N/A';
    const maleParticleHits = ok.filter(r => r.checks?.hasMaleParticle).length;
    const autoFlagHits = ok.filter(r => r.autoFlags?.length > 0).length;
    const manualReviewCount = ok.filter(r => r.needsManualReview).length;
    const failed = allRuns.length - ok.length;

    const maleRate = ok.length ? ((maleParticleHits / ok.length) * 100).toFixed(0) : 0;
    const flagRate = ok.length ? ((autoFlagHits / ok.length) * 100).toFixed(0) : 0;
    const manualRate = ok.length ? ((manualReviewCount / ok.length) * 100).toFixed(0) : 0;

    md += `| **${model}** | ${avgEval} tok/s | ${avgWall} ms | ${maleParticleHits}/${ok.length} (${maleRate}%) | ${autoFlagHits}/${ok.length} (${flagRate}%) | ${manualReviewCount}/${ok.length} (${manualRate}%) | ${failed}/${allRuns.length} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 💬 รายละเอียดคำตอบแยกตามเคส (Case-by-Case Comparison)\n\n`;

  const models = allResults.map(r => r.model);
  md += `| รายละเอียดเคส (Case / Input) | ` + models.map(m => `${m}`).join(' | ') + ` |\n`;
  md += `| :--- | ` + models.map(() => `:---`).join(' | ') + ` |\n`;

  const firstModelResult = allResults[0];
  if (firstModelResult) {
    for (let cIdx = 0; cIdx < firstModelResult.cases.length; cIdx++) {
      const caseId = firstModelResult.cases[cIdx].caseId;
      const input = firstModelResult.cases[cIdx].input;

      let rowText = `| **${caseId}**<br><br>Input: \`${escapeMarkdownTable(input)}\` | `;

      const modelCells = [];
      for (const modelData of allResults) {
        const cData = modelData.cases.find(c => c.caseId === caseId);
        if (!cData) {
          modelCells.push('N/A');
          continue;
        }

        const caseOkRuns = cData.runs.filter(r => !r.error);
        const caseAvgSpeed = caseOkRuns.length
          ? (caseOkRuns.reduce((s, r) => s + (r.stats?.evalRate || 0), 0) / caseOkRuns.length).toFixed(1)
          : 'N/A';
        const caseAvgWall = caseOkRuns.length
          ? Math.round(caseOkRuns.reduce((s, r) => s + (r.wallClockMs || 0), 0) / caseOkRuns.length)
          : 'N/A';

        let cellContent = `⚡ **Avg:** ${caseAvgSpeed} tok/s \| ${caseAvgWall} ms<br><br>`;

        const runOutputs = cData.runs.map(r => {
          if (r.error) {
            return `❌ **Run ${r.run}:** Error: ${escapeMarkdownTable(r.error)}`;
          }

          let warnings = [];
          if (r.checks.hasMaleParticle) warnings.push('🚨 ครับ');
          if (r.checks.hasMetaLeak) warnings.push('⚠️ meta-leak');
          if (r.checks.hasPlaceholder) warnings.push('⚠️ placeholder');
          if (r.autoFlags.length > 0) {
            r.autoFlags.forEach(f => {
              if (!f.includes('meta-leak') && !f.includes('placeholder')) {
                warnings.push(`⚠️ ${f}`);
              }
            });
          }

          const warnText = warnings.length > 0 ? ` <font color="red">(${warnings.join(', ')})</font>` : '';
          const escapedReply = escapeMarkdownTable(r.reply);

          return `👤 **Run ${r.run} (${r.emotion}):**<br>"${escapedReply}"${warnText}`;
        });

        cellContent += runOutputs.join('<br><br>');
        modelCells.push(cellContent);
      }

      rowText += modelCells.join(' | ') + ` |`;
      md += rowText + `\n`;
    }
  }

  return md;
}

async function main() {
  const models = process.argv.slice(2);
  if (models.length === 0) {
    if (!process.env.AI_MODEL) {
      console.error('ไม่ได้ระบุโมเดล และไม่มี AI_MODEL ใน .env');
      console.error('วิธีใช้: node benchmark_models.js <model1> [model2] [model3...]');
      process.exit(1);
    }
    models.push(process.env.AI_MODEL);
  }

  console.log(`จะรัน CHARACTER_BENCHMARK (${CHARACTER_BENCHMARK.length} เคส) กับ ${models.length} โมเดล: ${models.join(', ')}`);
  console.log(`num_predict=${NUM_PREDICT}, temperature=${TEMPERATURE}, top_p=${TOP_P}, runs=${BENCH_RUNS}`);

  const allResults = [];
  for (const model of models) {
    const modelResult = await runModel(model);
    allResults.push(modelResult);

    console.log(`[Ollama] Unloading model ${model}...`);
    try {
      await client.generate({
        model: model,
        prompt: '',
        keep_alive: 0,
      });
      console.log(`[Ollama] Model ${model} unloaded.`);
    } catch (unloadErr) {
      console.log(`[Ollama] Failed to unload ${model}: ${unloadErr.message}`);
    }
  }

  printSummaryTable(allResults);

  // เขียนผลละเอียดลงไฟล์เพื่อย้อนกลับมาอ่าน/เทียบทีหลัง
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  
  const outPath = path.join(logsDir, `benchmark_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ config: { NUM_PREDICT, TEMPERATURE, TOP_P, BENCH_RUNS }, allResults }, null, 2), 'utf8');
  console.log(`\nบันทึกผลละเอียดไว้ที่: ${outPath}`);

  // เขียนรายงานเปรียบเทียบในรูปแบบ Markdown
  const mdReport = generateMarkdownReport(allResults, { NUM_PREDICT, TEMPERATURE, TOP_P, BENCH_RUNS });
  const mdPath = path.join(logsDir, `benchmark_comparison_${Date.now()}.md`);
  fs.writeFileSync(mdPath, mdReport, 'utf8');
  console.log(`บันทึกรายงานเปรียบเทียบ (Markdown) ไว้ที่: ${mdPath}`);
}

main().catch(err => {
  console.error('เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
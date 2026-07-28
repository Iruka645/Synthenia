const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PROMPT_SECTION_ORDER,
  buildMemoryContext,
  buildSystemPrompt,
} = require("../src/prompts/system_builder");
const { PERSONALITY } = require("../src/config/personality");

test("buildSystemPrompt combines prompt sections in the recommended order", () => {
  const prompt = buildSystemPrompt();

  const expectedOrder = [
    "identity",
    "personality",
    "speech_style",
    "emotion_input",
    "json_schema",
    "memory_context",
  ];
  if (PROMPT_SECTION_ORDER.includes("examples")) {
    expectedOrder.push("examples");
  }

  assert.deepEqual(PROMPT_SECTION_ORDER, expectedOrder);

  const expectedHeadings = [
    "# Identity",
    "# Personality",
    "# Speech Style",
    "# Emotion Input",
    "# JSON Schema",
    "# Memory Context",
  ];
  if (PROMPT_SECTION_ORDER.includes("examples")) {
    expectedHeadings.push("# Examples");
  }

  const positions = expectedHeadings.map((heading) => prompt.indexOf(heading));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
  );
});

test("buildMemoryContext renders relationship summary, facts, and fallback messages", () => {
  const memoryContext = buildMemoryContext({
    reflectiveSummary: "Ken เป็นคนสำคัญของซิน และชอบทำงานหนัก",
    facts: [{ fact_text: "Ken ชอบให้ซินตอบสั้นๆ" }],
    usedFallback: true,
    fallbackMessages: [
      { role: "user", content: "วันนี้เหนื่อยมาก" },
      { role: "assistant", content: "พักบ้างสิพ่อ" },
    ],
  });

  assert.match(memoryContext, /\[ภาพรวมความสัมพันธ์ของคุณกับ Ken\]/);
  assert.match(memoryContext, /Ken เป็นคนสำคัญของซิน/);
  assert.match(memoryContext, /\[ข้อมูลความจำระยะยาวที่เกี่ยวข้อง\]/);
  assert.match(memoryContext, /- Ken ชอบให้ซินตอบสั้นๆ/);
  assert.match(memoryContext, /\[บันทึกข้อความในอดีตที่เกี่ยวข้อง\]/);
  assert.match(memoryContext, /- Ken: วันนี้เหนื่อยมาก/);
  assert.match(memoryContext, /- Syn: พักบ้างสิพ่อ/);
});

test("personality config exports the built modular system prompt", () => {
  assert.equal(PERSONALITY, buildSystemPrompt());
  assert.match(PERSONALITY, /ตอบเป็น JSON เท่านั้น/);
  assert.match(PERSONALITY, /"emotion": "neutral \| happy \| laugh \| embarrassed \| annoyed \| sad \| thinking \| surprised"/);
});

const { CHARACTER_BENCHMARK } = require("../src/prompts/character_benchmark");

test("character benchmark covers core Syn personality scenarios", () => {
  assert.equal(CHARACTER_BENCHMARK.length, 10);
  assert.ok(
    CHARACTER_BENCHMARK.every((caseItem) =>
      caseItem.id &&
      caseItem.input &&
      Array.isArray(caseItem.expectedSignals) &&
      caseItem.expectedSignals.length > 0 &&
      Array.isArray(caseItem.allowedEmotions) &&
      caseItem.allowedEmotions.length > 0,
    ),
  );
  assert.ok(CHARACTER_BENCHMARK.some((caseItem) => caseItem.id === "comfort-tired-ken"));
  assert.ok(CHARACTER_BENCHMARK.some((caseItem) => caseItem.id === "json-only"));
});

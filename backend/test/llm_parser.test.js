const assert = require("node:assert/strict");
const test = require("node:test");
const BaseLLMProvider = require("../src/services/llm/providers/baseLLMProvider");

test("BaseLLMProvider _parseContent - parses valid structured JSON correctly", () => {
  const provider = new BaseLLMProvider();
  const raw = '{"reply": "สวัสดีค่ะเคน!", "emotion": "happy"}';
  const result = provider._parseContent(raw);
  assert.equal(result.reply, "สวัสดีค่ะเคน!");
  assert.equal(result.emotion, "happy");
});

test("BaseLLMProvider _parseContent - strips markdown block code if present", () => {
  const provider = new BaseLLMProvider();
  const raw = '```json\n{"reply": "ดีจ้า", "emotion": "laugh"}\n```';
  const result = provider._parseContent(raw);
  assert.equal(result.reply, "ดีจ้า");
  assert.equal(result.emotion, "laugh");
});

test("BaseLLMProvider _parseContent - fallback keys (response, content, text)", () => {
  const provider = new BaseLLMProvider();
  
  const raw1 = '{"response": "กินข้าวหรือยัง?", "emotion": "thinking"}';
  const result1 = provider._parseContent(raw1);
  assert.equal(result1.reply, "กินข้าวหรือยัง?");
  assert.equal(result1.emotion, "thinking");

  const raw2 = '{"content": "เหนื่อยจัง", "mood": "sad"}';
  const result2 = provider._parseContent(raw2);
  assert.equal(result2.reply, "เหนื่อยจัง");
  assert.equal(result2.emotion, "sad");

  const raw3 = '{"text": "โอเคจ้า"}';
  const result3 = provider._parseContent(raw3);
  assert.equal(result3.reply, "โอเคจ้า");
  assert.equal(result3.emotion, "neutral"); // fallback mood
});

test("BaseLLMProvider _parseContent - returns full raw content on invalid JSON if it has no JSON chars", () => {
  const provider = new BaseLLMProvider();
  const raw = "สวัสดีค่ะพี่เคน วันนี้ซินมีความสุขจังเลย";
  const result = provider._parseContent(raw);
  assert.equal(result.reply, "สวัสดีค่ะพี่เคน วันนี้ซินมีความสุขจังเลย");
  assert.equal(result.emotion, "neutral");
});

test("BaseLLMProvider _parseContent - throws error on malformed JSON containing JSON chars", () => {
  const provider = new BaseLLMProvider();
  const raw = '{"reply": "สวัสดี", '; // malformed JSON
  assert.throws(() => {
    provider._parseContent(raw);
  }, Error);
});

test("BaseLLMProvider _parseContent - throws error on empty/null inputs", () => {
  const provider = new BaseLLMProvider();
  assert.throws(() => {
    provider._parseContent(null);
  }, Error);

  assert.throws(() => {
    provider._parseContent("   ");
  }, Error);
});

test("BaseLLMProvider _parseContent - throws error on reasoning/thinking blocks", () => {
  const provider = new BaseLLMProvider();
  const raw = '{"analysis": "We need to say hello in Thai", "thought": "Ken is the father"}';
  assert.throws(() => {
    provider._parseContent(raw);
  }, /Model returned thinking\/analysis block/);
});

test("BaseLLMProvider _parseContent - handles arrays inside JSON responses", () => {
  const provider = new BaseLLMProvider();
  const raw = '[{"reply": "สวัสดีจ้า", "emotion": "happy"}]';
  const result = provider._parseContent(raw);
  assert.equal(result.reply, "สวัสดีจ้า");
  assert.equal(result.emotion, "happy");
});

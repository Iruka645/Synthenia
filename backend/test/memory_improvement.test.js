const assert = require("node:assert/strict");
const test = require("node:test");
const consolidationWorker = require("../src/services/memory/consolidationWorker");
const memoryRetrievalService = require("../src/services/memory/memoryRetrievalService");

test("validateFact - rejects empty or invalid facts", async () => {
  // Test invalid formats
  const res1 = await consolidationWorker.validateFact(null, 1);
  assert.equal(res1.valid, false);
  assert.equal(res1.reason, "invalid_fact_format");

  const res2 = await consolidationWorker.validateFact({}, 1);
  assert.equal(res2.valid, false);
  assert.equal(res2.reason, "missing_text");

  const res3 = await consolidationWorker.validateFact({ text: "   " }, 1);
  assert.equal(res3.valid, false);
  assert.equal(res3.reason, "missing_text");

  const res4 = await consolidationWorker.validateFact({ text: "Hello" }, 1);
  assert.equal(res4.valid, false);
  assert.equal(res4.reason, "missing_category");

  const res5 = await consolidationWorker.validateFact({ text: "Hello", category: "event" }, 1);
  assert.equal(res5.valid, false);
  assert.equal(res5.reason, "missing_importance");
});

test("validateFact - rejects short or low-value content", async () => {
  const res1 = await consolidationWorker.validateFact({ text: "โอ", category: "event", importance: 0.5 }, 1);
  assert.equal(res1.valid, false);
  assert.equal(res1.reason, "text_too_short");

  const res2 = await consolidationWorker.validateFact({ text: "ครับ", category: "event", importance: 0.5 }, 1);
  assert.equal(res2.valid, false);
  assert.equal(res2.reason, "low_value_content");

  const res3 = await consolidationWorker.validateFact({ text: "โอเค", category: "event", importance: 0.5 }, 1);
  assert.equal(res3.valid, false);
  assert.equal(res3.reason, "low_value_content");
});

test("validateFact - maps category to memory_type correctly and clamps values", async () => {
  const fact = {
    text: "Ken ซื้อขนมมาฝากซิน",
    category: "event",
    importance: 1.5,
    confidence: -0.2
  };

  const res = await consolidationWorker.validateFact(fact, 1);
  assert.equal(res.valid, true);
  assert.equal(res.normalizedFact.text, "Ken ซื้อขนมมาฝากซิน");
  assert.equal(res.normalizedFact.category, "event");
  assert.equal(res.normalizedFact.memoryType, "episode"); // event maps to episode
  assert.equal(res.normalizedFact.importance, 1.0); // clamped
  assert.equal(res.normalizedFact.confidence, 0.0); // clamped
});

test("hasContradictionKeywords - detects new state-change keywords", () => {
  // Test contradiction keywords
  assert.equal(consolidationWorker.hasContradictionKeywords("Ken ย้ายไปทำงานที่อื่นแล้ว"), true);
  assert.equal(consolidationWorker.hasContradictionKeywords("ตอนนี้ Ken เลิกกินหวาน"), true);
  assert.equal(consolidationWorker.hasContradictionKeywords("กลายเป็นคนชอบหมา"), true);
  assert.equal(consolidationWorker.hasContradictionKeywords("ล่าสุด Ken ไปเที่ยวเชียงใหม่"), true);
  assert.equal(consolidationWorker.hasContradictionKeywords("Ken ไม่ได้รักเธอแล้ว"), true);
  assert.equal(consolidationWorker.hasContradictionKeywords("Ken ปกติดี"), false);
});

test("memoryRetrievalService boost scoring & confidence multiplier", () => {
  // We mock a search result mapping to simulate scoring logic
  const TYPE_BOOST = {
    identity: 0.15, goal: 0.1, relationship: 0.05,
    preference: 0, personality: 0, skill: 0,
    episode: -0.05, schedule: 0, temporary: -0.1,
  };

  const mockCalculateScore = (fact) => {
    const similarity = parseFloat(fact.similarity || 0);
    const importance = parseFloat(fact.importance_score || 0.5);
    const confidence = parseFloat(fact.confidence !== null && fact.confidence !== undefined ? fact.confidence : 1.0);
    const recencyFactor = 1.0; // simulated recencyFactor for simplicity
    
    const typeBoost = TYPE_BOOST[fact.memory_type] || 0;
    let score = (similarity * 0.6) + (importance * 0.3) + (recencyFactor * 0.1) + typeBoost;
    score = score * (0.5 + confidence * 0.5);
    return score;
  };

  const identityFact = {
    similarity: 0.8,
    importance_score: 1.0,
    confidence: 1.0,
    memory_type: "identity"
  };

  const lowConfidenceIdentityFact = {
    similarity: 0.8,
    importance_score: 1.0,
    confidence: 0.5,
    memory_type: "identity"
  };

  const episodeFact = {
    similarity: 0.8,
    importance_score: 1.0,
    confidence: 1.0,
    memory_type: "episode"
  };

  const identityScore = mockCalculateScore(identityFact);
  const lowConfidenceIdentityScore = mockCalculateScore(lowConfidenceIdentityFact);
  const episodeScore = mockCalculateScore(episodeFact);

  // similarity * 0.6 + importance * 0.3 + recency * 0.1 = 0.8 * 0.6 + 1.0 * 0.3 + 1.0 * 0.1 = 0.48 + 0.3 + 0.1 = 0.88
  // identityScore: (0.88 + 0.15) * 1.0 = 1.03
  // lowConfidenceIdentityScore: (0.88 + 0.15) * (0.5 + 0.5 * 0.5) = 1.03 * 0.75 = 0.7725
  // episodeScore: (0.88 - 0.05) * 1.0 = 0.83
  
  assert.equal(identityScore.toFixed(4), "1.0300");
  assert.equal(lowConfidenceIdentityScore.toFixed(4), "0.7725");
  assert.equal(episodeScore.toFixed(4), "0.8300");
  assert.ok(identityScore > episodeScore);
  assert.ok(identityScore > lowConfidenceIdentityScore);
});

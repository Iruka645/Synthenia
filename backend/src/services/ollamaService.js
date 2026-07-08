require("dotenv").config();

const { PERSONALITY, MODEL_CONFIG } = require("../config/personality");
const { buildMemoryContext, buildSystemPrompt } = require("../prompts/system_builder");
const memoryRetrievalService = require("./memory/memoryRetrievalService");
const llmManager = require("./llm/index");

// For preloading Ollama models locally on startup
const { Ollama } = require("ollama");
const AI_MODEL = process.env.AI_MODEL;
const Ollama_BASE_URL = process.env.Ollama_BaseURL || "http://localhost";
const Ollama_PORT = process.env.Ollama_Port || 11434;

const ollama = new Ollama({
  host: `${Ollama_BASE_URL}:${Ollama_PORT}`,
});

let conversationHistory = [{ role: "system", content: PERSONALITY }];

async function chat(userMessage, precalculatedEmbedding = null) {
  let memoryContext = "";
  try {
    const [retrievalResult, reflectiveSummary] = await Promise.all([
      memoryRetrievalService.retrieve(userMessage, 5, precalculatedEmbedding),
      memoryRetrievalService.getLatestReflectiveSummary()
    ]);
    const { facts, usedFallback, fallbackMessages } = retrievalResult;

    memoryContext = buildMemoryContext({ reflectiveSummary, facts, usedFallback, fallbackMessages });
  } catch (memErr) {
    console.error("Error fetching memory context for chat:", memErr);
  }

  conversationHistory[0].content = buildSystemPrompt({ memoryContext });
  conversationHistory.push({ role: "user", content: userMessage });

  try {
    const ai = await llmManager.chat(conversationHistory);

    console.log("Reply:", ai.reply);
    console.log("Emotion:", ai.emotion);
    conversationHistory.push({ role: "assistant", content: ai.reply });

    if (conversationHistory.length > 21) {
      conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-20)];
    }

    return { reply: ai.reply, emotion: ai.emotion };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

let isModelReady = false;

function isReady() {
  return isModelReady;
}

async function preloadModels() {
  console.log(`[Ollama Service] Starting preloading for models...`);
  try {
    const embeddingService = require('./memory/embeddingService');
    console.log(`[Ollama Service] Preloading embedding model (bge-m3)...`);
    await embeddingService.getEmbedding("ping");
    console.log(`[Ollama Service] Embedding model preloaded successfully.`);
  } catch (err) {
    console.warn(`[Ollama Service] Failed to preload embedding model:`, err.message);
  }

  try {
    console.log(`[Ollama Service] Preloading chat model (${AI_MODEL})...`);
    await ollama.chat({
      model: AI_MODEL,
      messages: [{ role: 'user', content: 'ping' }],
      keep_alive: '30m'
    });
    console.log(`[Ollama Service] Chat model preloaded successfully.`);
    isModelReady = true;
  } catch (err) {
    console.error(`[Ollama Service] Failed to preload chat model:`, err.message);
    isModelReady = true;
  }
}

function resetHistory() {
  conversationHistory = [{ role: "system", content: PERSONALITY }];
}

module.exports = { chat, resetHistory, isReady, preloadModels };

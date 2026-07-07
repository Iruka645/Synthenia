// Calling libraries
const { Ollama } = require("ollama");

//ENV declaration
require("dotenv").config();
const AI_MODEL = process.env.AI_MODEL;
const Ollama_BASE_URL = process.env.Ollama_BaseURL || "http://localhost";
const Ollama_PORT = process.env.Ollama_Port || 11434;

// สร้าง Ollama client พร้อม custom fetch timeout
// Default undici headers timeout = 10 วินาที — น้อยเกินไปสำหรับ gemma4:12b ที่อาจใช้หลายนาที
const CHAT_TIMEOUT_MS = 5 * 60_000; // 5 นาที

const ollama = new Ollama({
  host: `${Ollama_BASE_URL}:${Ollama_PORT}`,
  fetch: (url, options) => {
    const signal = AbortSignal.timeout(CHAT_TIMEOUT_MS);
    return fetch(url, { ...options, signal });
  },
});

//Config import
const { PERSONALITY, MODEL_CONFIG } = require("../config/personality");
const { buildMemoryContext, buildSystemPrompt } = require("../prompts/system_builder");
const memoryRetrievalService = require("./memory/memoryRetrievalService");

// Get the messages and response
let conversationHistory = [{ role: "system", content: PERSONALITY }];
async function chat(userMessage, precalculatedEmbedding = null) {
  // Retrieve memory context
  let memoryContext = "";
  try {
    const { facts, usedFallback, fallbackMessages } =
      await memoryRetrievalService.retrieve(userMessage, 5, precalculatedEmbedding);
    const reflectiveSummary =
      await memoryRetrievalService.getLatestReflectiveSummary();

    memoryContext = buildMemoryContext({
      reflectiveSummary,
      facts,
      usedFallback,
      fallbackMessages,
    });
  } catch (memErr) {
    console.error("Error fetching memory context for chat:", memErr);
  }

  // Update system prompt with memory context
  conversationHistory[0].content = buildSystemPrompt({ memoryContext });
  conversationHistory.push({ role: "user", content: userMessage });

  try {
    const response = await ollama.chat({
      model: MODEL_CONFIG.model,
      messages: conversationHistory,
      options: MODEL_CONFIG.options,
      stream: false,
      format: {
        type: "object",
        properties: {
          reply: {
            type: "string",
          },
          emotion: {
            type: "string",
            enum: [
              "neutral",
              "happy",
              "embarrassed",
              "sad",
              "thinking",
              "surprised",
              "laugh",
              "annoyed",
            ],
          },
        },
        required: ["reply", "emotion"],
      },
    });

    let aiContent = response.message.content;
    // Safety check: Some models wrap JSON inside ```json ... ``` blocks
    if (aiContent.includes("```")) {
      const match = aiContent.match(/```(?:json)?([\s\S]*?)```/);
      if (match) {
        aiContent = match[1];
      }
    }

    let ai;
    try {
      ai = JSON.parse(aiContent.trim());
    } catch (parseErr) {
      console.error("JSON parse ล้มเหลว, raw content:", aiContent);
      // Fallback: ใช้ raw text เป็น reply ตรงๆ แทนที่จะโยน error ทั้งระบบ
      ai = {
        reply: aiContent.trim() || "ขอโทษค่ะ พูดไม่ค่อยรู้เรื่องตอนนี้",
        emotion: "neutral",
      };
    }

    console.log("Reply:", ai.reply);
    console.log("Emotion:", ai.emotion);
    conversationHistory.push({ role: "assistant", content: ai.reply });

    if (conversationHistory.length > 21) {
      conversationHistory = [
        conversationHistory[0],
        ...conversationHistory.slice(-20),
      ];
    }

    return {
      reply: ai.reply,
      emotion: ai.emotion,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function resetHistory() {
  conversationHistory = [{ role: "system", content: PERSONALITY }];
}

module.exports = { chat, resetHistory };


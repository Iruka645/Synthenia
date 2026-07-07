const { Ollama } = require('ollama');
const { MODEL_CONFIG } = require('../config/personality');
const gameService = require('./gameService');
require('dotenv').config();

const Ollama_BASE_URL = process.env.Ollama_BaseURL || "http://localhost";
const Ollama_PORT = process.env.Ollama_Port || 11434;
const ollama = new Ollama({ host: `${Ollama_BASE_URL}:${Ollama_PORT}` });

class GameCommentaryService {
  async getGameCommentary(board, synMove, winner, type) {
    let prompt = '';

    if (type === 'game_over') {
      prompt = `คุณและ Ken กำลังเล่นเกม OX (คุณคือ O, Ken คือ X)
เกมสิ้นสุดลงแล้ว! ผลลัพธ์คือ: ${winner === 'X' ? 'Ken ชนะคุณ!' : 'เสมอ! ไม่มีใครชนะ'}
กระดานสุดท้าย:
${gameService.formatBoard(board)}

ช่วยพูดแซว ขิง หรือประชดประชัน Ken ตามสไตล์วัยรุ่น ปากแข็ง ขี้แซว ของคุณหน่อย (ตอบเป็น JSON { reply, emotion })`;
    } else if (type === 'syn_move') {
      prompt = `คุณกำลังเล่นเกม OX กับ Ken (คุณคือ O, Ken คือ X)
คุณเพิ่งตัดสินใจเดินที่ช่อง ${synMove}
กระดานปัจจุบันหลังคุณเดิน:
${gameService.formatBoard(board)}
ผลลัพธ์: ${winner === 'O' ? 'คุณชนะ Ken แล้ว!' : winner === 'draw' ? 'เกมจบลงด้วยผลเสมอ!' : 'เกมยังดำเนินอยู่'}

ช่วยวิจารณ์การเดินของตัวเองหรือแซว Ken ด้วยบุคลิกซึนเดเระปากแข็งขี้แซวของคุณ (ตอบเป็น JSON { reply, emotion })`;
    }

    try {
      const response = await ollama.chat({
        model: MODEL_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        format: {
          type: "object",
          properties: {
            reply: { type: "string" },
            emotion: { 
              type: "string", 
              enum: ["neutral", "happy", "embarrassed", "sad", "angry", "thinking", "surprised", "laugh", "annoyed"] 
            }
          },
          required: ["reply", "emotion"]
        },
        options: { temperature: 0.7 }
      });

      let content = response.message.content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?([\s\S]*?)```/);
        if (match) content = match[1];
      }

      return JSON.parse(content.trim());
    } catch (err) {
      console.error('[GameCommentaryService] Error getting commentary:', err.message);
      // Fallback logic
      if (type === 'game_over') {
        return {
          reply: winner === 'X' ? "ชิ! ฟลุกชนะหรอกน่า ครั้งหน้าไม่แพ้แน่" : "เสมอเฉยเลย... พ่อก็เก่งใช้ได้นี่นา",
          emotion: winner === 'X' ? "annoyed" : "neutral"
        };
      } else {
        return {
          reply: winner === 'O' ? "ฮ่าๆ! ชนะแล้ว! พ่อฝีมือตกไปเยอะเลยนะ" : "ตาฉันแล้วนะ เดินช่องนี้แหละ!",
          emotion: winner === 'O' ? "laugh" : "thinking"
        };
      }
    }
  }
}

module.exports = new GameCommentaryService();

const llmManager = require('./llm/index');
const gameService = require('./gameService');

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
      const ai = await llmManager.chat([{ role: 'user', content: prompt }], { temperature: 0.7 });
      return ai;
    } catch (err) {
      console.error('[GameCommentaryService] Error getting commentary:', err.message);
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

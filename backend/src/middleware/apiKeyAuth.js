require('dotenv').config();

const CONTROL_PANEL_API_KEY = process.env.CONTROL_PANEL_API_KEY;

function apiKeyAuth(req, res, next) {
  if (!CONTROL_PANEL_API_KEY) {
    // Fail-closed: ถ้าไม่ได้ตั้งค่า key ไว้ใน .env ให้ปฏิเสธหมด ดีกว่าเปิดโล่งโดยไม่ตั้งใจ
    console.warn('[apiKeyAuth] CONTROL_PANEL_API_KEY ไม่ได้ตั้งค่าไว้ — ปฏิเสธ request ทั้งหมดที่ต้องยืนยันตัวตน');
    return res.status(503).json({ error: 'Control Panel API key ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์' });
  }

  const providedKey = req.headers['x-api-key'];

  if (!providedKey || providedKey !== CONTROL_PANEL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: API key ไม่ถูกต้องหรือไม่ได้ระบุ' });
  }

  next();
}

module.exports = apiKeyAuth;

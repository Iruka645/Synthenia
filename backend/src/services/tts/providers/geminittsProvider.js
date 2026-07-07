// providers/geminiTTSProvider.js
//
// Fallback chain: Gemini 3.1 TTS → Gemini 2.5 TTS → gTTS (offline fallback สุดท้าย)
// เพราะ quota รวมกันแค่ 20 RPD ต้องมี tracking + fallback ที่รัดกุม

const BaseTTSProvider = require('./baseProvider');
const GTTSProvider = require('./gttsProvider');
const path = require('path');
const fs = require('fs');
const { query } = require('../../../db/pool');

const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', '..', 'audio');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ตรวจสอบชื่อ model string ที่ถูกต้องจริงจาก Google AI Studio ก่อนใช้งาน
// เพราะชื่อ preview model เปลี่ยนบ่อย ชื่อด้านล่างเป็น placeholder ตามรูปแบบที่ Google ใช้
const MODELS = {
  gemini31: 'gemini-3.1-flash-tts-preview',
  gemini25: 'gemini-2.5-flash-preview-tts',
};

// เก็บ quota counter ใน database
// รีเซ็ตตอนเที่ยงคืน Pacific Time (ตาม RPD reset ของ Gemini API)
class QuotaTracker {
  constructor(limitPerModel = 10) {
    this.limitPerModel = limitPerModel;
    this._initialized = false;
  }

  async _init() {
    if (this._initialized) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS quota_tracking (
          key VARCHAR(50) PRIMARY KEY,
          count INT DEFAULT 0,
          date_key VARCHAR(20),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      this._initialized = true;
    } catch (err) {
      console.error('[GeminiTTS] Error initializing quota_tracking table:', err.message);
    }
  }

  _getPacificDateKey() {
    // ใช้ Intl เพื่อคำนวณวันที่ตาม Pacific Time โดยไม่ต้องพึ่ง library เพิ่ม
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  }

  async _checkAndResetIfNewDay() {
    await this._init();
    const currentKey = this._getPacificDateKey();
    try {
      const result = await query(`SELECT date_key FROM quota_tracking LIMIT 1`);
      if (result.rows.length > 0) {
        const storedKey = result.rows[0].date_key;
        if (storedKey !== currentKey) {
          // Reset all models
          await query(`
            INSERT INTO quota_tracking (key, count, date_key, updated_at)
            VALUES ('gemini31', 0, $1, NOW()), ('gemini25', 0, $1, NOW())
            ON CONFLICT (key) DO UPDATE
            SET count = 0, date_key = EXCLUDED.date_key, updated_at = NOW()
          `, [currentKey]);
          console.log('[GeminiTTS] Quota reset for a new day in DB (Pacific Time)');
        }
      } else {
        // Table empty, insert default values
        await query(`
          INSERT INTO quota_tracking (key, count, date_key, updated_at)
          VALUES ('gemini31', 0, $1, NOW()), ('gemini25', 0, $1, NOW())
          ON CONFLICT (key) DO NOTHING
        `, [currentKey]);
      }
    } catch (err) {
      console.error('[GeminiTTS] Error resetting quota in DB:', err.message);
    }
  }

  async canUse(modelKey) {
    await this._checkAndResetIfNewDay();
    try {
      const result = await query(`SELECT count FROM quota_tracking WHERE key = $1`, [modelKey]);
      if (result.rows.length > 0) {
        return result.rows[0].count < this.limitPerModel;
      }
      return true;
    } catch (err) {
      console.error(`[GeminiTTS] Error checking quota for ${modelKey}:`, err.message);
      return true; // fallback to true on DB error to not block system
    }
  }

  async recordUsage(modelKey) {
    await this._checkAndResetIfNewDay();
    try {
      await query(`
        INSERT INTO quota_tracking (key, count, date_key, updated_at)
        VALUES ($1, 1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET count = quota_tracking.count + 1, updated_at = NOW()
      `, [modelKey, this._getPacificDateKey()]);
    } catch (err) {
      console.error(`[GeminiTTS] Error recording usage for ${modelKey}:`, err.message);
    }
  }

  async getStatus() {
    await this._checkAndResetIfNewDay();
    try {
      const result = await query(`SELECT key, count FROM quota_tracking`);
      const counts = { gemini31: 0, gemini25: 0 };
      result.rows.forEach(row => {
        counts[row.key] = row.count;
      });
      return { ...counts, limitPerModel: this.limitPerModel };
    } catch (err) {
      console.error('[GeminiTTS] Error getting quota status from DB:', err.message);
      return { gemini31: 0, gemini25: 0, limitPerModel: this.limitPerModel };
    }
  }
}

// ปรับ limitPerModel ตามโควต้าจริงที่พี่ได้ (ตัวอย่างนี้ตั้งไว้ 10+10=20 ตามที่แจ้ง)
const quotaTracker = new QuotaTracker(10);

class GeminiTTSProvider extends BaseTTSProvider {
  constructor() {
    super();
    this.gttsProvider = new GTTSProvider();
  }

  async synthesize(text) {
    if (!GEMINI_API_KEY) {
      console.warn('[GeminiTTS] ไม่มี GEMINI_API_KEY ตั้งค่าไว้ ข้ามไปใช้ gTTS ทันที');
      return this.gttsProvider.synthesize(text);
    }

    // ลำดับที่ 1: Gemini 3.1
    if (await quotaTracker.canUse('gemini31')) {
      try {
        const result = await this._callGeminiTTS(text, MODELS.gemini31);
        await quotaTracker.recordUsage('gemini31');
        return result;
      } catch (err) {
        console.warn(`[GeminiTTS] 3.1 ล้มเหลว (${err.message}) — ลอง 2.5 ต่อ`);
      }
    } else {
      console.log('[GeminiTTS] 3.1 หมดโควต้าวันนี้แล้ว — ลอง 2.5 ต่อ');
    }

    // ลำดับที่ 2: Gemini 2.5
    if (await quotaTracker.canUse('gemini25')) {
      try {
        const result = await this._callGeminiTTS(text, MODELS.gemini25);
        await quotaTracker.recordUsage('gemini25');
        return result;
      } catch (err) {
        console.warn(`[GeminiTTS] 2.5 ล้มเหลว (${err.message}) — fallback ไป gTTS`);
      }
    } else {
      console.log('[GeminiTTS] 2.5 หมดโควต้าวันนี้แล้ว — fallback ไป gTTS');
    }

    // ลำดับสุดท้าย: gTTS (offline-ish fallback เดิมที่ใช้อยู่ก่อนหน้า)
    return this.gttsProvider.synthesize(text);
  }

  async _callGeminiTTS(text, modelName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Leda' }, // เลือก voice ที่มีอยู่ในเอกสาร Gemini TTS
            },
          },
        },
      }),
    });

    if (response.status === 429) {
      throw new Error(`quota exceeded (429) สำหรับ ${modelName}`);
    }
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const audioPart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);

    if (!audioPart) {
      throw new Error('ไม่พบ audio data ใน response');
    }

    // Gemini คืนเสียงเป็น base64 PCM/WAV ตาม inlineData.mimeType
    const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    const filename = `speech_${Date.now()}.wav`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(outputPath, audioBuffer);
    return filename;
  }

  // เผื่ออยากเช็กสถานะ quota ผ่าน route แยก
  async getQuotaStatus() {
    return await quotaTracker.getStatus();
  }
}

module.exports = GeminiTTSProvider;
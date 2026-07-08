const { query } = require('../../db/pool');

class ConfigService {
  constructor() {
    this._cache = new Map();
  }

  async get(key, defaultValue = null) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    try {
      const result = await query(`SELECT value FROM system_config WHERE key = $1`, [key]);
      if (result.rows.length > 0) {
        const value = result.rows[0].value;
        this._cache.set(key, value);
        return value;
      }
    } catch (err) {
      console.error(`[ConfigService] Error reading key "${key}":`, err.message);
    }

    return defaultValue;
  }

  async set(key, value, changedBy = 'system') {
    const oldValue = await this.get(key, null);

    try {
      await query(
        `INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
      this._cache.set(key, value);

      // Fire-and-forget audit log — ไม่ควรบล็อกการ switch provider ถ้า log เขียนไม่สำเร็จ
      query(
        `INSERT INTO config_change_log (config_key, old_value, new_value, changed_by, changed_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, NOW())`,
        [key, JSON.stringify(oldValue), JSON.stringify(value), changedBy]
      ).catch(logErr => {
        console.error(`[ConfigService] Failed to write audit log for "${key}":`, logErr.message);
      });
    } catch (err) {
      console.error(`[ConfigService] Error writing key "${key}":`, err.message);
      throw err;
    }
  }

  async getAll(prefix = '') {
    try {
      const result = await query(
        `SELECT key, value FROM system_config WHERE key LIKE $1 ORDER BY key`,
        [`${prefix}%`]
      );
      const out = {};
      for (const row of result.rows) {
        out[row.key] = row.value;
        this._cache.set(row.key, row.value);
      }
      return out;
    } catch (err) {
      console.error('[ConfigService] Error getAll:', err.message);
      return {};
    }
  }

  invalidate(key) {
    this._cache.delete(key);
  }

  async delete(key, changedBy = 'system') {
    const oldValue = await this.get(key, null);
    try {
      await query(`DELETE FROM system_config WHERE key = $1`, [key]);
      this._cache.delete(key);

      // Fire-and-forget audit log
      query(
        `INSERT INTO config_change_log (config_key, old_value, new_value, changed_by, changed_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, NOW())`,
        [key, JSON.stringify(oldValue), JSON.stringify(null), changedBy]
      ).catch(logErr => {
        console.error(`[ConfigService] Failed to write audit log for delete "${key}":`, logErr.message);
      });
    } catch (err) {
      console.error(`[ConfigService] Error deleting key "${key}":`, err.message);
      throw err;
    }
  }
}

module.exports = new ConfigService();

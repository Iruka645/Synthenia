import React, { useState } from 'react';
import { verifyApiKey } from '../services/api';

export const ApiKeyGate = ({ onSuccess }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await verifyApiKey(apiKey.trim());
      // Save to sessionStorage so it persists across page refreshes within the tab session
      sessionStorage.setItem('synthenia_api_key', apiKey.trim());
      onSuccess(apiKey.trim());
    } catch (err) {
      console.error('[ApiKeyGate] Verification failed:', err);
      if (err.response && err.response.status === 401) {
        setError('API Key ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      } else if (err.response && err.response.status === 503) {
        setError('เซิร์ฟเวอร์ยังไม่ได้เปิดใช้งาน Control Panel API key');
      } else {
        setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      color: 'var(--text-h)',
      fontFamily: 'Inter, sans-serif'
    }}>
      <form 
        onSubmit={handleSubmit}
        style={{
          background: 'rgba(30, 30, 45, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          borderRadius: '24px',
          padding: '40px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          textAlign: 'center'
        }}
      >
        <div>
          <span style={{ fontSize: '48px' }}>🔐</span>
          <h2 style={{ marginTop: '16px', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-h)' }}>
            เข้าสู่ Control Panel
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', lineHeight: '1.6' }}>
            กรุณากรอก API Key ที่ตั้งค่าไว้ในไฟล์ระบบ (.env) เพื่อเข้าสู่การจัดการระบบเบื้องหลัง
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
            CONTROL PANEL API KEY
          </label>
          <input
            type="password"
            placeholder="••••••••••••••••"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={loading}
            style={{
              background: 'rgba(10, 10, 15, 0.8)',
              color: 'var(--text-h)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.2s',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {error && (
          <div style={{
            fontSize: '12px',
            color: '#ff6b6b',
            background: 'rgba(255, 107, 107, 0.1)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 107, 107, 0.15)',
            lineHeight: '1.5',
            textAlign: 'left'
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !apiKey.trim()}
          style={{
            padding: '14px',
            background: loading ? 'rgba(255,255,255,0.05)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading || !apiKey.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: !apiKey.trim() ? 'none' : '0 4px 12px rgba(var(--accent-rgb), 0.3)'
          }}
        >
          {loading ? '⏳ กำลังยืนยันตัวตน...' : 'เข้าใช้งาน'}
        </button>
      </form>
    </div>
  );
};

export default ApiKeyGate;

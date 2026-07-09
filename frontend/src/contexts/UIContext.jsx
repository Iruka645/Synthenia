import React, { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showConfirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      setConfirmState({
        title,
        message,
        resolve: (value) => {
          setConfirmState(null);
          resolve(value);
        }
      });
    });
  }, []);

  return (
    <UIContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Floating Toast Container */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '350px',
        width: '100%',
        pointerEvents: 'none'
      }}>
        {toasts.map((t) => {
          let bg = 'var(--card)';
          let border = '1px solid var(--border)';
          let color = 'var(--text-h)';
          let icon = 'ℹ️';

          if (t.type === 'success') {
            bg = 'rgba(81, 207, 102, 0.15)';
            border = '1px solid rgba(81, 207, 102, 0.3)';
            color = '#51cf66';
            icon = '✅';
          } else if (t.type === 'error') {
            bg = 'rgba(255, 107, 107, 0.15)';
            border = '1px solid rgba(255, 107, 107, 0.3)';
            color = '#ff6b6b';
            icon = '⚠️';
          }

          return (
            <div
              key={t.id}
              style={{
                background: bg,
                border: border,
                color: color,
                padding: '12px 16px',
                borderRadius: '12px',
                boxShadow: 'var(--shadow)',
                backdropFilter: 'blur(8px)',
                fontSize: '13.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                pointerEvents: 'auto',
                animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              <span>{icon}</span>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0 4px',
                  opacity: 0.7
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog Overlay */}
      {confirmState && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: 'var(--text-h)',
            fontFamily: 'system-ui, sans-serif',
            animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              {confirmState.title}
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.5 }}>
              {confirmState.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => confirmState.resolve(false)}
                style={{
                  padding: '10px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  color: 'var(--text-h)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => confirmState.resolve(true)}
                style={{
                  padding: '10px 16px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.2)'
                }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inject Keyframe Animations dynamically */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%) translateY(-10px); opacity: 0; }
          to { transform: translateX(0) translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
export default UIContext;

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    sessionStorage.removeItem('synthenia_api_key');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'var(--bg)',
          color: 'var(--text-h)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '550px',
            width: '100%',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '48px' }}>⚠️</span>
              <h2 style={{ fontSize: '1.4rem', margin: '12px 0 6px 0', fontWeight: 700 }}>
                เกิดข้อผิดพลาดในการโหลดระบบหน้าจอ
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text)', opacity: 0.8, margin: 0 }}>
                (UI Render Failure Detected)
              </p>
            </div>

            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              fontFamily: 'ui-monospace, Consolas, monospace',
              overflowX: 'auto',
              maxHeight: '180px',
              color: '#ff6b6b'
            }}>
              <strong>Error:</strong> {this.state.error?.toString()}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                🔄 รีเฟรชหน้าเว็บ
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-h)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                🔒 ล้างประวัติล็อกอิน
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

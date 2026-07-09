import React, { useState, useEffect } from 'react';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('synthenia-theme');
    if (saved) return saved;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('synthenia-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('synthenia-theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={`สลับเป็นโหมด${theme === 'dark' ? 'กลางวัน' : 'กลางคืน'}`}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border)',
        color: 'var(--text-h)',
        padding: '8px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        height: '36px',
        width: '36px'
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
};

export default ThemeToggle;

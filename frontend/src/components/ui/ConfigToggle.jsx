import React from 'react';

export const ConfigToggle = ({ label, checked, onChange, disabled }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      gap: '12px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-h)' }}>
        {label}
      </span>
      <label style={{
        position: 'relative',
        display: 'inline-block',
        width: '50px',
        height: '26px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1
      }}>
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={(e) => !disabled && onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: checked ? 'var(--accent)' : 'var(--border)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRadius: '34px',
          boxShadow: checked ? '0 0 10px rgba(var(--accent-rgb), 0.5)' : 'none'
        }}>
          <span style={{
            position: 'absolute',
            content: '""',
            height: '20px',
            width: '20px',
            left: '3px',
            bottom: '3px',
            backgroundColor: '#fff',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '50%',
            transform: checked ? 'translateX(24px)' : 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </span>
      </label>
    </div>
  );
};

export default ConfigToggle;

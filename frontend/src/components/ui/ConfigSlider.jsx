import React from 'react';

export const ConfigSlider = ({ label, min, max, step, value, onChange, disabled, valueSuffix = '', helpText }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      opacity: disabled ? 0.6 : 1,
      transition: 'opacity 0.2s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-h)' }}>
          {label}
        </span>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: 700, 
          color: 'var(--accent)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          padding: '2px 8px',
          borderRadius: '6px'
        }}>
          {value}{valueSuffix}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => !disabled && onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{
          width: '100%',
          accentColor: 'var(--accent)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: '6px',
          borderRadius: '3px',
          outline: 'none'
        }}
      />

      {helpText && (
        <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.85 }}>
          {helpText}
        </span>
      )}
    </div>
  );
};

export default ConfigSlider;

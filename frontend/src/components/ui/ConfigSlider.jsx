import React from 'react';

export const ConfigSlider = ({ label, min, max, step, value, onChange, disabled, valueSuffix = '', helpText }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
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
          background: 'rgba(255, 255, 255, 0.05)',
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
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
          {helpText}
        </span>
      )}
    </div>
  );
};

export default ConfigSlider;

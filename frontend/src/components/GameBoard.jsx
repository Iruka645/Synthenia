import React from 'react';

export const GameBoard = ({ board, onCellClick, loading, winner, onReset }) => {
  return (
    <div 
      className="game-board-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        background: 'var(--card)',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(10px)',
        width: '100%',
        maxWidth: '320px',
        margin: '0 auto',
        fontFamily: 'Inter, sans-serif',
        boxShadow: 'var(--shadow)'
      }}
    >
      <div 
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}
      >
        <span style={{ color: 'var(--text-h)', fontSize: '16px', fontWeight: 'bold' }}>เล่นเกม OX กับซิน</span>
        <button
          onClick={onReset}
          style={{
            padding: '5px 10px',
            background: 'rgba(255, 75, 75, 0.15)',
            border: '1px solid rgba(255, 75, 75, 0.3)',
            color: '#ff4b4b',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s',
            fontWeight: 600
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 75, 75, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 75, 75, 0.15)';
          }}
        >
          เริ่มใหม่
        </button>
      </div>

      {/* 3x3 Grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          width: '100%',
          aspectRatio: '1',
          marginBottom: '15px'
        }}
      >
        {board.map((cell, index) => (
          <button
            key={index}
            disabled={cell !== null || loading || winner !== null}
            onClick={() => onCellClick(index)}
            style={{
              background: cell === 'X' 
                ? 'rgba(0, 168, 255, 0.1)' 
                : cell === 'O' 
                  ? 'rgba(255, 0, 128, 0.1)' 
                  : 'var(--bg)',
              border: cell === 'X'
                ? '1px solid rgba(0, 168, 255, 0.4)'
                : cell === 'O'
                  ? '1px solid rgba(255, 0, 128, 0.4)'
                  : '1px solid var(--border)',
              color: cell === 'X' ? '#00a8ff' : cell === 'O' ? '#ff0080' : 'var(--text-h)',
              fontSize: '28px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: cell === null && !loading && !winner ? 'pointer' : 'default',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              transition: 'all 0.2s',
              boxShadow: cell ? '0 0 10px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseOver={(e) => {
              if (cell === null && !loading && !winner) {
                e.currentTarget.style.background = 'var(--code-bg)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseOut={(e) => {
              if (cell === null && !loading && !winner) {
                e.currentTarget.style.background = 'var(--bg)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            {cell}
          </button>
        ))}
      </div>

      {/* Status Info */}
      <div 
        style={{
          width: '100%',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text)',
          padding: '8px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px'
        }}
      >
        {loading ? (
          <span style={{ color: '#ff0080', fontWeight: '500' }}>ซินกำลังคิดการเดิน...</span>
        ) : winner === 'X' ? (
          <span style={{ color: '#00a8ff', fontWeight: 'bold' }}>ยินดีด้วย! คุณชนะซินแล้ว!</span>
        ) : winner === 'O' ? (
          <span style={{ color: '#ff0080', fontWeight: 'bold' }}>ฮ่าๆ ซินชนะคุณแล้ว!</span>
        ) : winner === 'draw' ? (
          <span style={{ color: 'var(--text-h)', fontWeight: 'bold' }}>เสมอกัน! ฝีมือพอๆ กันเลย</span>
        ) : (
          <span>ตาคุณแล้ว (คุณคือ X, ซินคือ O)</span>
        )}
      </div>
    </div>
  );
};

export default GameBoard;

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
        background: 'rgba(20, 20, 30, 0.6)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        width: '100%',
        maxWidth: '320px',
        margin: '0 auto',
        fontFamily: 'Inter, sans-serif'
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
        <span style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>เล่นเกม OX กับซิน</span>
        <button
          onClick={onReset}
          style={{
            padding: '5px 10px',
            background: 'rgba(255, 75, 75, 0.2)',
            border: '1px solid rgba(255, 75, 75, 0.5)',
            color: '#ff4b4b',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 75, 75, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 75, 75, 0.2)';
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
                  : 'rgba(255, 255, 255, 0.05)',
              border: cell === 'X'
                ? '1px solid rgba(0, 168, 255, 0.4)'
                : cell === 'O'
                  ? '1px solid rgba(255, 0, 128, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              color: cell === 'X' ? '#00a8ff' : cell === 'O' ? '#ff0080' : '#fff',
              fontSize: '28px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: cell === null && !loading && !winner ? 'pointer' : 'default',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              transition: 'all 0.2s',
              boxShadow: cell ? '0 0 10px rgba(0,0,0,0.2)' : 'none'
            }}
            onMouseOver={(e) => {
              if (cell === null && !loading && !winner) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              if (cell === null && !loading && !winner) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
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
          color: 'rgba(255,255,255,0.7)',
          padding: '8px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '8px'
        }}
      >
        {loading ? (
          <span style={{ color: '#ff0080' }}>ซินกำลังคิดการเดิน...</span>
        ) : winner === 'X' ? (
          <span style={{ color: '#00a8ff', fontWeight: 'bold' }}>ยินดีด้วย! คุณชนะซินแล้ว!</span>
        ) : winner === 'O' ? (
          <span style={{ color: '#ff0080', fontWeight: 'bold' }}>ฮ่าๆ ซินชนะคุณแล้ว!</span>
        ) : winner === 'draw' ? (
          <span style={{ color: '#aaa' }}>เสมอกัน! ฝีมือพอๆ กันเลย</span>
        ) : (
          <span>ตาคุณแล้ว (คุณคือ X, ซินคือ O)</span>
        )}
      </div>
    </div>
  );
};

export default GameBoard;

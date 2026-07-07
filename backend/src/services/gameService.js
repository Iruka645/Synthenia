class GameService {
  checkWinner(board) {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]; // 'X' or 'O'
      }
    }

    if (board.every(cell => cell !== null)) {
      return 'draw';
    }

    return null;
  }

  // Simple Minimax for Tic-Tac-Toe
  getBestMove(board, player) {
    let bestScore = -Infinity;
    let move = -1;

    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = player; // 'O'
        let score = this.minimax(board, 0, false);
        board[i] = null;
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }

    // Fallback if no moves are possible
    if (move === -1) {
      const available = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
    }

    return move;
  }

  minimax(board, depth, isMaximizing) {
    const winner = this.checkWinner(board);
    if (winner === 'O') return 10 - depth;
    if (winner === 'X') return depth - 10;
    if (winner === 'draw') return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'O';
          let score = this.minimax(board, depth + 1, false);
          board[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'X';
          let score = this.minimax(board, depth + 1, true);
          board[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  }

  formatBoard(board) {
    const getSymbol = (val, idx) => val === null ? `${idx}` : val;
    return `
    [${getSymbol(board[0], 0)}] [${getSymbol(board[1], 1)}] [${getSymbol(board[2], 2)}]
    [${getSymbol(board[3], 3)}] [${getSymbol(board[4], 4)}] [${getSymbol(board[5], 5)}]
    [${getSymbol(board[6], 6)}] [${getSymbol(board[7], 7)}] [${getSymbol(board[8], 8)}]
    `.trim();
  }
}

module.exports = new GameService();

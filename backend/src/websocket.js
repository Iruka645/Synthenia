const { Server } = require('socket.io');
const securityConfig = require('./config/securityConfig');

let io = null;

function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: securityConfig.allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('[WebSocket] Socket.IO not initialized. Call initWebSocket() first.');
  }
  return io;
}

module.exports = { initWebSocket, getIO };


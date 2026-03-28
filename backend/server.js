require('dotenv').config();
const app = require('./app');
const env = require('./config/env');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./config/initDatabase');

// Initialize database (run migrations) before starting server
initializeDatabase()
  .then(() => {
    const server = app.listen(env.port, () => {
      console.log(`Smart Gate backend listening on port ${env.port}`);
    });

    // Setup WebSocket (Socket.IO)
    const io = new Server(server, {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000', '*'],
        methods: ['GET', 'POST']
      }
    });

    // Store io instance globally untuk diakses di controller
    global.io = io;

    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });

      // Join to receive dashboard updates
      socket.on('join-dashboard', () => {
        socket.join('dashboard');
        console.log(`✅ Client ${socket.id} joined dashboard room`);
      });

      socket.on('leave-dashboard', () => {
        socket.leave('dashboard');
        console.log(`✅ Client ${socket.id} left dashboard room`);
      });
    });

    server.on('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        console.error(`Port ${env.port} sedang dipakai proses lain. Tutup proses lama lalu jalankan ulang backend.`);
        process.exit(1);
      }

      console.error('Backend startup error:', error);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error('❌ FATAL: Failed to start backend due to database error');
    console.error(error.message);
    process.exit(1);
  });



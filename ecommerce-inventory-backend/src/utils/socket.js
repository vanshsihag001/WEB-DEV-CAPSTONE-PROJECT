const { Server } = require('socket.io');
const User = require('../models/User');
const { verifyAccessToken } = require('./tokens');
const cfg = require('../config/env');

let io = null;

/**
 * Socket.IO setup.
 * Auth: client must connect with  io(url, { auth: { token: '<accessToken>' } }).
 * Rooms: every socket joins  user:<id>  and  role:<role>.
 */
exports.initSocket = (httpServer) => {
  io = new Server(httpServer, { cors: { origin: cfg.clientOrigin } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('role isActive name');
      if (!user || !user.isActive) return next(new Error('Invalid user'));
      socket.user = { id: user._id.toString(), role: user.role, name: user.name };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
    socket.emit('connected', { userId: socket.user.id, role: socket.user.role });
  });
  return io;
};

exports.getIO = () => io;

// Safe emit helpers (no-ops when Socket.IO is not initialised, e.g. in scripts/tests)
exports.emitToUser = (userId, event, payload) => {
  if (io && userId) io.to(`user:${userId.toString()}`).emit(event, payload);
};
exports.emitToRole = (role, event, payload) => {
  if (io) io.to(`role:${role}`).emit(event, payload);
};

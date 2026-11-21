const http = require('http');
const cfg = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./utils/socket');
const registerListeners = require('./listeners/notificationListeners');

(async () => {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  registerListeners();
  server.listen(cfg.port, () => console.log(`Server running on http://localhost:${cfg.port} (${cfg.nodeEnv})`));

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})().catch((err) => { console.error('Failed to start server:', err.message); process.exit(1); });

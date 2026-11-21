const morgan = require('morgan');
const { nodeEnv } = require('../config/env');
// Request logging middleware (HTTP method, URL, status, response time)
module.exports = morgan(nodeEnv === 'production' ? 'combined' : 'dev', { skip: () => nodeEnv === 'test' });

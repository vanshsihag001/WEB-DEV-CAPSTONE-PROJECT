const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cfg = require('./config/env');
const logger = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(helmet());
app.use(cors({ origin: cfg.clientOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use(logger);

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'E-Commerce API is running', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

app.use(notFound);
app.use(errorHandler);
module.exports = app;

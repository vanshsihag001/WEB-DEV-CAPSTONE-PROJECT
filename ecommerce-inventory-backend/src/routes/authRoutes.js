const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' } });

router.post('/register', limiter, validate(s.register), c.register);
router.post('/login', limiter, validate(s.login), c.login);
router.post('/refresh', validate(s.refresh), c.refresh);
router.post('/logout', validate(s.refresh), c.logout);
module.exports = router;

const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect, restrictTo('seller', 'admin'), validate(s.reportQuery, 'query'));
router.get('/sales', c.salesSummary);
router.get('/best-sellers', c.bestSellers);
router.get('/inventory', c.inventorySummary);
module.exports = router;

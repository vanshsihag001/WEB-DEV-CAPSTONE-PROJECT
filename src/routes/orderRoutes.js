const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect);
router.post('/checkout', restrictTo('customer'), validate(s.checkout), c.checkout);
router.get('/', validate(s.orderList, 'query'), c.list);
router.get('/:id', validateObjectId('id'), c.get);
router.patch('/:id/status', validateObjectId('id'), validate(s.orderStatus), c.updateStatus);
module.exports = router;

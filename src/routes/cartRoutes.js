const router = require('express').Router();
const c = require('../controllers/cartController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect, restrictTo('customer'));
router.get('/', c.getCart);
router.post('/items', validate(s.cartAdd), c.addItem);
router.patch('/items/:productId', validateObjectId('productId'), validate(s.cartUpdate), c.updateItem);
router.delete('/items/:productId', validateObjectId('productId'), c.removeItem);
router.delete('/', c.clear);
module.exports = router;

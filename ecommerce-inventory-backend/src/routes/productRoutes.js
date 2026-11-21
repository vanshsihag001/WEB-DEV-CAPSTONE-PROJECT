const router = require('express').Router();
const c = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const s = require('../validators/schemas');

const staff = [protect, restrictTo('seller', 'admin')];

// Public catalogue
router.get('/', validate(s.productList, 'query'), c.list);
// Seller/admin views (declared before '/:id')
router.get('/mine', ...staff, c.mine);
router.get('/low-stock', ...staff, c.lowStock);
router.get('/:id', validateObjectId('id'), c.get);

router.post('/', ...staff, validate(s.productCreate), c.create);
router.patch('/:id', ...staff, validateObjectId('id'), validate(s.productUpdate), c.update);
router.patch('/:id/stock', ...staff, validateObjectId('id'), validate(s.stockAdjust), c.adjustStock);
router.delete('/:id', ...staff, validateObjectId('id'), c.remove);
module.exports = router;

const router = require('express').Router();
const c = require('../controllers/categoryController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const s = require('../validators/schemas');

router.get('/', c.list);
router.get('/:id', validateObjectId('id'), c.get);
router.post('/', protect, restrictTo('admin'), validate(s.category), c.create);
router.patch('/:id', protect, restrictTo('admin'), validateObjectId('id'), validate(s.categoryUpdate), c.update);
router.delete('/:id', protect, restrictTo('admin'), validateObjectId('id'), c.remove);
module.exports = router;

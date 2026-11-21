const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(protect);
router.get('/me', c.getMe);
router.patch('/me', validate(s.updateMe), c.updateMe);

router.use(restrictTo('admin'));
router.get('/', validate(s.userList, 'query'), c.listUsers);
router.get('/:id', validateObjectId('id'), c.getUser);
router.patch('/:id', validateObjectId('id'), validate(s.adminUpdateUser), c.updateUser);
router.delete('/:id', validateObjectId('id'), c.deactivateUser);
module.exports = router;

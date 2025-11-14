const express = require('express');
const { verifyAdmin } = require('../middleware/auth');
const { getStats, getAllUsers, deleteUser } = require('../controllers/adminController');

const router = express.Router();

router.get('/stats', verifyAdmin, getStats);
router.get('/users', verifyAdmin, getAllUsers);
router.delete('/users/:id', verifyAdmin, deleteUser);

module.exports = router;
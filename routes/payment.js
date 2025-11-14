// backend/routes/payment.js

const express = require('express');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const {
  createPaymentOrder,
  verifyPayment,
  getAdminWallet,
  getPaymentHistory,
  getStudentPurchaseHistory,
  updateBankDetails,
  requestWithdrawal
} = require('../controllers/paymentController');

const router = express.Router();

// ✅ THIS ROUTE MUST EXIST
router.get('/admin/wallet', verifyAdmin, getAdminWallet);

router.post('/create-order', verifyToken, createPaymentOrder);
router.post('/verify', verifyToken, verifyPayment);
router.get('/admin/history', verifyAdmin, getPaymentHistory);
router.get('/student/purchases', verifyToken, getStudentPurchaseHistory);
router.put('/admin/bank-details', verifyAdmin, updateBankDetails);
router.post('/admin/withdraw', verifyAdmin, requestWithdrawal);

module.exports = router;
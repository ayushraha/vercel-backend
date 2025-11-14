const Payment = require('../models/Payment');
const AdminWallet = require('../models/AdminWallet');
const Note = require('../models/Note');
const User = require('../models/User');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

const PLATFORM_FEE_PERCENTAGE = 10; // 10% platform fee

// Create Razorpay Order
const createPaymentOrder = async (req, res) => {
  try {
    const { noteId, amount } = req.body;
    const studentId = req.user.id;

    if (!noteId || !amount) {
      return res.status(400).json({ success: false, message: 'Note ID and amount are required' });
    }

    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (!note.isPremium) {
      return res.status(400).json({ success: false, message: 'This is not a premium note' });
    }

    if (note.price !== amount) {
      return res.status(400).json({ success: false, message: 'Amount mismatch' });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    const payment = new Payment({
      studentId,
      noteId,
      amount,
      transactionId: order.id,
      razorpayOrderId: order.id,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      message: 'Order created successfully',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Verify Payment and Update Wallet
const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, noteId } = req.body;
    const studentId = req.user.id;

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Find and update payment
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpayOrderId },
      {
        status: 'completed',
        razorpayPaymentId,
        razorpaySignature,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Calculate fees
    const platformFee = Math.round(payment.amount * (PLATFORM_FEE_PERCENTAGE / 100));
    const adminProfit = payment.amount - platformFee;

    // Update payment with fee details
    payment.platformFee = platformFee;
    payment.adminProfit = adminProfit;
    payment.adminBalance = adminProfit;
    await payment.save();

    // Get note details
    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    // Update admin wallet
    let adminWallet = await AdminWallet.findOne({ adminId: note.uploadedBy });

    if (!adminWallet) {
      adminWallet = new AdminWallet({
        adminId: note.uploadedBy
      });
    }

    adminWallet.totalEarnings += adminProfit;
    adminWallet.currentBalance += adminProfit;
    adminWallet.transactions.push(payment._id);
    await adminWallet.save();

    // Update note paid downloads
    note.paidDownloads += 1;
    await note.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment,
      adminProfit
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Admin Wallet
const getAdminWallet = async (req, res) => {
  try {
    const adminId = req.user.id;

    // Try to find existing wallet
    let wallet = await AdminWallet.findOne({ adminId })
      .populate('transactions');

    // ✅ NEW: If wallet doesn't exist, CREATE IT
    if (!wallet) {
      wallet = new AdminWallet({
        adminId,
        totalEarnings: 0,
        currentBalance: 0,
        totalWithdrawals: 0,
        pendingBalance: 0,
        transactions: [],
        bankAccount: {
          accountHolderName: '',
          accountNumber: '',
          ifscCode: '',
          bankName: ''
        }
      });

      await wallet.save();
      console.log(`✅ New wallet created for admin: ${adminId}`);
    }

    res.json({ success: true, wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Payment History
const getPaymentHistory = async (req, res) => {
  try {
    const adminId = req.user.id;

    const payments = await Payment.find({ 'note.uploadedBy': adminId })
      .populate('studentId', 'name email')
      .populate('noteId', 'title subject price')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Student Purchase History
const getStudentPurchaseHistory = async (req, res) => {
  try {
    const studentId = req.user.id;

    const purchases = await Payment.find({
      studentId,
      status: 'completed'
    })
      .populate('noteId', 'title subject price')
      .populate('studentId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: purchases.length, purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update Bank Account Details
const updateBankDetails = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

    let wallet = await AdminWallet.findOne({ adminId });

    if (!wallet) {
      wallet = new AdminWallet({ adminId });
    }

    wallet.bankAccount = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName
    };

    await wallet.save();

    res.json({ success: true, message: 'Bank details updated successfully', wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Request Withdrawal
const requestWithdrawal = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { amount } = req.body;

    const wallet = await AdminWallet.findOne({ adminId });

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    if (wallet.currentBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    wallet.currentBalance -= amount;
    wallet.pendingBalance += amount;
    await wallet.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      pendingBalance: wallet.pendingBalance,
      currentBalance: wallet.currentBalance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
const initializeAdminWallet = async (req, res) => {
  try {
    const adminId = req.user.id;

    const existingWallet = await AdminWallet.findOne({ adminId });

    if (existingWallet) {
      return res.json({
        success: true,
        message: 'Wallet already exists',
        wallet: existingWallet
      });
    }

    const newWallet = new AdminWallet({
      adminId,
      totalEarnings: 0,
      currentBalance: 0,
      totalWithdrawals: 0,
      pendingBalance: 0,
      transactions: [],
      bankAccount: {
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: ''
      }
    });

    await newWallet.save();

    res.json({
      success: true,
      message: 'Admin wallet initialized successfully',
      wallet: newWallet
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getAdminWallet,
  getPaymentHistory,
  initializeAdminWallet,
  getStudentPurchaseHistory,
  updateBankDetails,
  requestWithdrawal
};
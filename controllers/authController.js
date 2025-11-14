const User = require('../models/User');
const AdminWallet = require('../models/AdminWallet');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    const { name, email, password, role, department, semester } = req.body;

    if (!name || !email || !password || !department || !semester) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'student',
      department,
      semester
    });

    await user.save();

    // ✅ NEW: If user is admin, create wallet
    if (user.role === 'admin') {
      const adminWallet = new AdminWallet({
        adminId: user._id,
        totalEarnings: 0,
        currentBalance: 0,
        totalWithdrawals: 0,
        pendingBalance: 0,
        transactions: []
      });
      await adminWallet.save();
      console.log(`✅ Admin wallet created for: ${user.email}`);
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        semester: user.semester
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // ✅ NEW: If admin login and no wallet exists, create it
    if (user.role === 'admin') {
      const walletExists = await AdminWallet.findOne({ adminId: user._id });
      if (!walletExists) {
        const adminWallet = new AdminWallet({
          adminId: user._id,
          totalEarnings: 0,
          currentBalance: 0,
          totalWithdrawals: 0,
          pendingBalance: 0,
          transactions: []
        });
        await adminWallet.save();
        console.log(`✅ Admin wallet created on login for: ${user.email}`);
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        semester: user.semester
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { register, login };
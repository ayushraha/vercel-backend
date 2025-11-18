const register = async (req, res) => {
  try {
    console.log('📝 Registration attempt:', req.body.email);

    const { name, email, password, role, department, semester } = req.body;

    if (!name || !email || !password || !department || !semester) {
      console.log('❌ Missing fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
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
    console.log('✅ User registered:', email);

    // Create admin wallet if admin
    if (user.role === 'admin') {
      const AdminWallet = require('../models/AdminWallet');
      const adminWallet = new AdminWallet({
        adminId: user._id
      });
      await adminWallet.save();
      console.log('✅ Admin wallet created');
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
    console.error('❌ Registration error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const login = async (req, res) => {
  try {
    console.log('🔑 Login attempt:', req.body.email);

    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Email or password missing');
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('✅ Login successful:', email);

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
    console.error('❌ Login error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

module.exports = { register, login };
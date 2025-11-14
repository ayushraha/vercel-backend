const User = require('../models/User');
const Note = require('../models/Note');

const getStats = async (req, res) => {
  try {
    const totalNotes = await Note.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    const downloadStats = await Note.aggregate([
      { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
    ]);

    const departmentStats = await Note.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalNotes,
        totalStudents,
        totalAdmins,
        totalDownloads: downloadStats[0]?.totalDownloads || 0,
        departmentStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Note.deleteMany({ uploadedBy: req.params.id });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStats, getAllUsers, deleteUser };
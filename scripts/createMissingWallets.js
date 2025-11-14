const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const AdminWallet = require('../models/AdminWallet');

dotenv.config();

const createMissingWallets = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sppu-notes');

    console.log('🔍 Searching for admins without wallets...');

    // Find all admins
    const admins = await User.find({ role: 'admin' });
    console.log(`Found ${admins.length} admins`);

    let created = 0;
    for (const admin of admins) {
      const walletExists = await AdminWallet.findOne({ adminId: admin._id });

      if (!walletExists) {
        const newWallet = new AdminWallet({
          adminId: admin._id,
          totalEarnings: 0,
          currentBalance: 0,
          totalWithdrawals: 0,
          pendingBalance: 0,
          transactions: []
        });
        await newWallet.save();
        console.log(`✅ Wallet created for: ${admin.email}`);
        created++;
      }
    }

    console.log(`\n✨ Migration complete! Created ${created} wallets.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
};

createMissingWallets();
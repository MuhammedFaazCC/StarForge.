const mongoose = require('mongoose');
const User = require('../models/userSchema');
const Config = require('../models/configSchema');
require('dotenv').config();

const testReferralSystem = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB for testing');

        // Initialize referral config if not exists
        const referrerBonusConfig = await Config.findOneAndUpdate(
            { key: 'referrer_bonus_amount' },
            { value: 100, updatedAt: new Date() },
            { upsert: true, new: true }
        );

        const newUserBonusConfig = await Config.findOneAndUpdate(
            { key: 'new_user_bonus_amount' },
            { value: 50, updatedAt: new Date() },
            { upsert: true, new: true }
        );

        console.log('✅ Referral configuration initialized:');
        console.log(`   - Referrer Bonus: ₹${referrerBonusConfig.value}`);
        console.log(`   - New User Bonus: ₹${newUserBonusConfig.value}`);

        // Test user creation with referral code
        const testUser = await User.findOne({ email: 'test@example.com' });
        if (testUser) {
            console.log('✅ Test user found with referral code:', testUser.referralCode);
            console.log('   - Wallet Balance:', testUser.wallet?.balance || 0);
            console.log('   - Referral Token:', testUser.referralToken ? 'Generated' : 'Missing');
        } else {
            console.log('ℹ️  No test user found. Create a user through signup to test referral system.');
        }

        // Check referral statistics
        const totalUsers = await User.countDocuments({});
        const usersWithReferralCodes = await User.countDocuments({ referralCode: { $exists: true, $ne: null } });
        const referredUsers = await User.countDocuments({ referredBy: { $exists: true, $ne: null } });

        console.log('📊 Referral System Statistics:');
        console.log(`   - Total Users: ${totalUsers}`);
        console.log(`   - Users with Referral Codes: ${usersWithReferralCodes}`);
        console.log(`   - Users who were referred: ${referredUsers}`);

        console.log('\n🎯 Referral System Test Complete!');
        console.log('\n📋 To test the complete flow:');
        console.log('1. Visit http://localhost:3000/signup to create a user');
        console.log('2. Login and visit http://localhost:3000/referral');
        console.log('3. Copy your referral link/code');
        console.log('4. Use it to sign up another user');
        console.log('5. Check wallet balances for both users');
        console.log('6. Admin can configure settings at http://localhost:3000/admin/referral-settings');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error testing referral system:', error);
        process.exit(1);
    }
};

testReferralSystem();

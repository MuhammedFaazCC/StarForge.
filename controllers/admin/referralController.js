const Config = require("../../models/configSchema");
const User = require("../../models/userSchema");

const getReferralSettings = async (req, res) => {
  try {
    const referrerBonusConfig = await Config.findOne({ key: 'referrer_bonus_amount' });
    const newUserBonusConfig = await Config.findOne({ key: 'new_user_bonus_amount' });
    
    const referrerBonus = referrerBonusConfig ? referrerBonusConfig.value : 100;
    const newUserBonus = newUserBonusConfig ? newUserBonusConfig.value : 50;

    const totalReferrals = await User.countDocuments({ referredBy: { $exists: true, $ne: null } });
    const totalReferrers = await User.countDocuments({ referralCode: { $exists: true, $ne: null } });
    
    const users = await User.find({});
    let totalBonusPaid = 0;
    
    users.forEach(user => {
      if (user.wallet && user.wallet.transactions) {
        const referralTransactions = user.wallet.transactions.filter(
          transaction => transaction.type === 'credit' && 
          (transaction.description.includes('Referral Bonus') || transaction.description.includes('Signup Bonus'))
        );
        totalBonusPaid += referralTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      }
    });

    const success = req.session.success || null;
    const error = req.session.error || null;
    req.session.success = null;
    req.session.error = null;

    res.render('admin/referralSettings', {
      admin: req.session.admin,
      referrerBonus,
      newUserBonus,
      totalReferrals,
      totalReferrers,
      totalBonusPaid,
      success,
      error,
      currentPage: 'referral'
    });
  } catch (error) {
    console.error('Error loading referral settings:', error);
    req.session.error = 'Failed to load referral settings';
    res.redirect('/admin/dashboard');
  }
};

const updateReferralSettings = async (req, res) => {
  try {
    const { referrerBonus, newUserBonus } = req.body;

    if (!referrerBonus || !newUserBonus || referrerBonus < 0 || newUserBonus < 0) {
      req.session.error = 'Please provide valid bonus amounts';
      return res.redirect('/admin/referral-settings');
    }

    await Config.findOneAndUpdate(
      { key: 'referrer_bonus_amount' },
      { value: parseInt(referrerBonus), updatedAt: new Date() },
      { upsert: true }
    );

    await Config.findOneAndUpdate(
      { key: 'new_user_bonus_amount' },
      { value: parseInt(newUserBonus), updatedAt: new Date() },
      { upsert: true }
    );

    req.session.success = 'Referral settings updated successfully';
    res.redirect('/admin/referral-settings');
  } catch (error) {
    console.error('Error updating referral settings:', error);
    req.session.error = 'Failed to update referral settings';
    res.redirect('/admin/referral-settings');
  }
};

module.exports = {
    getReferralSettings,
    updateReferralSettings
};
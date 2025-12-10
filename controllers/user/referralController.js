const User = require('../../models/userSchema');
const Coupon = require('../../models/couponSchema');
const Config = require('../../models/configSchema');
const crypto = require('crypto');

const generateReferralToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateCouponCode = (prefix = 'REF') => {
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${randomString}`;
};

const getReferralInfo = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId).select('referralCode referralToken referralPoints referralRewards');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.referralToken) {
            user.referralToken = generateReferralToken();
            await user.save();
        }

        const referralCount = await User.countDocuments({ referredBy: userId });
        
        const unusedRewards = user.referralRewards.filter(reward => !reward.isUsed);

        const referralData = {
            referralCode: user.referralCode,
            referralToken: user.referralToken,
            referralPoints: user.referralPoints,
            referralCount,
            unusedRewards,
            referralUrl: `${req.protocol}://${req.get('host')}/signup?ref=${user.referralCode}`
        };

        res.json({
            success: true,
            data: referralData
        });

    } catch (error) {
        console.error('Error getting referral info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get referral information'
        });
    }
};

const processReferralSignup = async (referralIdentifier, newUserId) => {
    try {
        let referringUser = null;

        if (referralIdentifier.length === 64) {
            referringUser = await User.findOne({ referralToken: referralIdentifier });
        } else {
            referringUser = await User.findOne({ referralCode: referralIdentifier });
        }

        if (!referringUser) {
            throw new Error('Invalid referral identifier');
        }

        // Check if new user already has a referrer (prevent multiple referrals)
        const newUser = await User.findById(newUserId);
        if (newUser.referredBy) {
            throw new Error('User already has a referrer');
        }

        // Get referral configuration
        const referrerBonusConfig = await Config.findOne({ key: 'referrer_bonus_amount' });
        const newUserBonusConfig = await Config.findOne({ key: 'new_user_bonus_amount' });
        
        const referrerBonus = referrerBonusConfig ? referrerBonusConfig.value : 100;
        const newUserBonus = newUserBonusConfig ? newUserBonusConfig.value : 50;

        // Update new user with referrer info and add signup bonus
        await User.findByIdAndUpdate(newUserId, {
            referredBy: referringUser._id,
            $inc: { 'wallet.balance': newUserBonus },
            $push: {
                'wallet.transactions': {
                    amount: newUserBonus,
                    type: 'credit',
                    description: 'Signup Bonus - Welcome bonus for joining through referral',
                    date: new Date()
                }
            }
        });

        // Add referrer bonus to referring user
        await User.findByIdAndUpdate(referringUser._id, {
            $inc: { 
                'wallet.balance': referrerBonus,
                'referralPoints': 50
            },
            $push: {
                'wallet.transactions': {
                    amount: referrerBonus,
                    type: 'credit',
                    description: `Referral Bonus - Earned for referring ${newUser.fullName}`,
                    date: new Date()
                }
            }
        });

        return {
            success: true,
            referringUser: referringUser._id,
            referrerBonus,
            newUserBonus,
            pointsEarned: 50
        };

    } catch (error) {
        console.error('Error processing referral signup:', error);
        throw error;
    }
};

const validateReferral = async (req, res) => {
    try {
        const { identifier } = req.params;
        
        let referringUser = null;

        if (identifier.length === 64) {
            referringUser = await User.findOne({ 
                referralToken: identifier,
                isActive: true,
                isBlocked: false 
            }).select('fullName email');
        } else {
            referringUser = await User.findOne({ 
                referralCode: identifier,
                isActive: true,
                isBlocked: false 
            }).select('fullName email');
        }

        if (!referringUser) {
            return res.json({
                success: false,
                message: 'Invalid or expired referral link'
            });
        }

        res.json({
            success: true,
            message: `You'll get benefits by signing up through ${referringUser.fullName}'s referral`,
            referrerName: referringUser.fullName
        });

    } catch (error) {
        console.error('Error validating referral:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate referral'
        });
    }
};

const getReferralDashboard = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).render('user/referralDashboard', {
                error: 'User not found',
                user: req.session.user
            });
        }

        if (!user.referralToken) {
            user.referralToken = generateReferralToken();
            await user.save();
        }

        // Get referral configuration
        const referrerBonusConfig = await Config.findOne({ key: 'referrer_bonus_amount' });
        const newUserBonusConfig = await Config.findOne({ key: 'new_user_bonus_amount' });
        
        const referrerBonus = referrerBonusConfig ? referrerBonusConfig.value : 100;
        const newUserBonus = newUserBonusConfig ? newUserBonusConfig.value : 50;

        const referralCount = await User.countDocuments({ referredBy: userId });
        const referredUsers = await User.find({ referredBy: userId })
            .select('fullName email createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        // Calculate total earnings from referrals
        const referralTransactions = user.wallet.transactions.filter(
            transaction => transaction.type === 'credit' && 
            transaction.description.includes('Referral Bonus')
        );
        const totalEarnings = referralTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

        const dashboardData = {
            user: req.session.user,
            referralCode: user.referralCode,
            referralToken: user.referralToken,
            referralPoints: user.referralPoints,
            referralCount,
            referredUsers,
            totalEarnings,
            referrerBonus,
            newUserBonus,
            walletBalance: user.wallet.balance,
            referralUrl: `${req.protocol}://${req.get('host')}/signup?ref=${user.referralCode}`,
            currentPage: 'referral',
            cartCount: 0
        };

        res.render('referralDashboard', dashboardData);

    } catch (error) {
        console.error('Error loading referral dashboard:', error);
        res.status(500).render('referralDashboard', {
            error: 'Failed to load referral dashboard',
            user: req.session.user,
            cartCount: 0,
            referralCount: 0,
            referralPoints: 0,
            totalEarnings: 0,
            referrerBonus: 100,
            newUserBonus: 50,
            walletBalance: 0,
            referredUsers: [],
            referralUrl: '',
            currentPage: 'referral'
        });
    }
};

const useReferralReward = async (userId, couponCode) => {
    try {
        await User.updateOne(
            { 
                _id: userId,
                'referralRewards.couponCode': couponCode 
            },
            { 
                $set: { 'referralRewards.$.isUsed': true } 
            }
        );
    } catch (error) {
        console.error('Error marking referral reward as used:', error);
    }
};

module.exports = {
    getReferralInfo,
    processReferralSignup,
    validateReferral,
    getReferralDashboard,
    useReferralReward,
    generateReferralToken,
    generateCouponCode
};
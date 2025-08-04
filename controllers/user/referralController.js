const User = require('../../models/userSchema');
const Coupon = require('../../models/couponSchema');
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
            referralUrl: `${req.protocol}://${req.get('host')}/signup?ref=${user.referralToken}`
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

        await User.findByIdAndUpdate(newUserId, {
            referredBy: referringUser._id
        });

        referringUser.referralPoints = (referringUser.referralPoints || 0) + 50;

        const couponCode = generateCouponCode();
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        const coupon = new Coupon({
            code: couponCode,
            discount: 10,
            expiryDate,
            status: 'Active',
            usageLimit: 1,
            minimumAmount: 500,
            usedBy: []
        });

        await coupon.save();

        referringUser.referralRewards.push({
            couponCode: couponCode,
            issuedAt: new Date(),
            isUsed: false
        });

        await referringUser.save();

        console.log(`Referral processed: ${referringUser.email} referred new user, earned 50 points and coupon ${couponCode}`);

        return {
            success: true,
            referringUser: referringUser._id,
            couponCode,
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
                error: 'User not found'
            });
        }

        if (!user.referralToken) {
            user.referralToken = generateReferralToken();
            await user.save();
        }

        const referralCount = await User.countDocuments({ referredBy: userId });
        const referredUsers = await User.find({ referredBy: userId })
            .select('fullName email createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        const unusedRewards = user.referralRewards.filter(reward => !reward.isUsed);

        const dashboardData = {
            user,
            referralCode: user.referralCode,
            referralToken: user.referralToken,
            referralPoints: user.referralPoints,
            referralCount,
            referredUsers,
            unusedRewards,
            referralUrl: `${req.protocol}://${req.get('host')}/signup?ref=${user.referralToken}`
        };

        res.render('user/referralDashboard', dashboardData);

    } catch (error) {
        console.error('Error loading referral dashboard:', error);
        res.status(500).render('user/referralDashboard', {
            error: 'Failed to load referral dashboard'
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
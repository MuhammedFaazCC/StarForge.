const mongoose = require('mongoose');
const Config = require('../models/configSchema');
require('dotenv').config();

const initReferralConfig = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found in environment variables');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if referral configs already exist
        const existingReferrerBonus = await Config.findOne({ key: 'referrer_bonus_amount' });
        const existingNewUserBonus = await Config.findOne({ key: 'new_user_bonus_amount' });

        if (!existingReferrerBonus) {
            await Config.create({
                key: 'referrer_bonus_amount',
                value: 100,
                updatedAt: new Date()
            });
            console.log('Created referrer bonus config: ₹100');
        } else {
            console.log('Referrer bonus config already exists: ₹' + existingReferrerBonus.value);
        }

        if (!existingNewUserBonus) {
            await Config.create({
                key: 'new_user_bonus_amount',
                value: 50,
                updatedAt: new Date()
            });
            console.log('Created new user bonus config: ₹50');
        } else {
            console.log('New user bonus config already exists: ₹' + existingNewUserBonus.value);
        }

        console.log('Referral configuration initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing referral config:', error);
        process.exit(1);
    }
};

initReferralConfig();

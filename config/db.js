const mongoose = require ('mongoose');
const env = require('dotenv').config();

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/StarForge';
        console.log('Connecting to MongoDB with URI:', uri);
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in the environment variables');
        }
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('DB connected');
    } catch (error) {
        console.log('DB Connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB
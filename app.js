const express = require("express");
const mongoose = require('mongoose');
const path = require("path");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./public/js/admin/adminRouter");
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const app = express();
db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/user"),
]);

app.use(session({
    secret: process.env.SESSION_SECRET || 'starforge-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8080/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const User = require('./models/userSchema');
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
            user = await User.create({
                fullName: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                role: 'customer',
                referralCode: Math.random().toString(36).slice(2, 10).toUpperCase()
            });
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const User = require('./models/userSchema');
    const user = await User.findById(id);
    done(null, user);
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/StarForge', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});
 
app.use("/", userRouter);
app.use("/admin", adminRouter);
app.use((req, res) => { 
  res.status(404).render("pageNotFound");
});
 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}/`);
});

module.exports = app;
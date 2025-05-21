const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const noCache = require("../middlewares/noCache");
const bcrypt = require("bcrypt");
const passport = require("passport");
const User = require("../models/userSchema");
const { userAuth } = require("../middlewares/auth");

router.get("/pageNotFound", userController.pageNotFound);

router.get("/", userController.loadHomepage);

router.get('/login', noCache, userController.loginPage);
router.post('/login', userController.login);

router.get("/signup", userController.signUpPage);
router.post("/signup", userController.signUp);

router.get("/forgotPassword", userController.forgotPasswordPage);
router.post("/forgotPassword", userController.forgotPassword);

router.get("/otp-verification", userController.otpVerificationPage);
router.post("/otp-verification", userController.verifyOTP);

router.get("/resetPassword", userController.resetPasswordGet);
router.post("/resetPassword", userController.resetPasswordPost);

router.get("/wishlist", userController.wishlistPage);

router.get("/cart", userController.cartPage);

router.get("/logout", userController.logout);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});

module.exports = router; 
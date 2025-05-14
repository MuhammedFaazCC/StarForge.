const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const bcrypt = require("bcrypt");
const passport = require("passport");
const User = require("../models/userSchema");

router.get("/pageNotFound", userController.pageNotFound);

router.get("/", userController.loadHomepage);

router.get("/login", userController.loginPage);
router.post("/login", userController.login);

router.get("/signup", userController.signUpPage);
router.post("/signup", userController.signUp);

router.get("/forgotPassword", userController.forgotPasswordPage);
router.post("/forgotPassword", userController.forgotPassword);

router.get("/resetPassword", userController.resetPasswordGet);
router.post("/resetPassword", userController.resetPasswordPost);

router.get("/wishlist", userController.wishlistPage);

router.get("/cart", userController.cartPage);

router.get("/logout", userController.logout);

router.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), userController.googleCallback);

module.exports = router;
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productContrller");
const noCache = require("../middlewares/noCache");
const bcrypt = require("bcrypt");
const passport = require("passport");
const User = require("../models/userSchema");
const { userAuth } = require("../middlewares/auth");

router.get("/login", noCache, userController.loginPage);
router.post("/login", userController.login);
router.get("/signup", userController.signUpPage);
router.post("/signup", userController.signUp);
router.get("/forgotPassword", userController.forgotPasswordPage);
router.post("/forgotPassword", userController.forgotPassword);
router.get("/otp-verification", userController.otpVerificationPage);
router.post("/otp-verification", userController.verifyOTP);
router.get("/resetPassword", userController.resetPasswordGet);
router.post("/resetPassword", userController.resetPasswordPost);
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), userController.googleCallback);

router.get("/pageNotFound", userAuth, userController.pageNotFound);
router.get("/", userAuth, userController.loadHomepage);
router.get("/products", userAuth, productController.getAllProduct);
router.get("/product/:id", userAuth, productController.getProductDetails);
router.get("/wishlist", userAuth, userController.wishlistPage);
router.get("/cart", userAuth, userController.cartPage);
router.get("/logout", userAuth, userController.logout);

module.exports = router;
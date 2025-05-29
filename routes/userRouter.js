const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productContrller");
const cartController = require("../controllers/user/cartController");
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
router.get("/resetPassword", userController.resetPassword);
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), userController.googleCallback);

router.get("/pageNotFound", userAuth, userController.pageNotFound);
router.get("/", userAuth, userController.loadHomepage);
router.get("/products", userAuth, productController.getAllProduct);
router.get("/product/:id", userAuth, productController.getProductDetails);
router.post('/product/:id/review', productController.postReview);
router.get("/wishlist", userAuth, userController.wishlistPage);
router.get("/logout", userAuth, userController.logout);
router.get("/LoadProfile", userAuth, userController.userDetails);
router.post("/editProfile", userAuth, userController.postEditProfile);
// router.post('/profile/request-otp', userAuth, userController.requestOtpForEmailChange);
router.get('/address', userAuth, userController.getAddressList);
router.get("/address/add", userAuth, userController.getAddAddress);
router.post('/address', userAuth, userController.postAddress);
router.get("/editAddress", userAuth, userController.getEditAddress);
router.get('/orders', userAuth, userController.getUserOrders);
router.post('/orders/:id/cancel', userAuth, userController.cancelOrder);
router.get('/wallet', userAuth, userController.getWallet)
router.get('/changePassword', userAuth, userController.getChangePassword);
router.post('/changePassword', userAuth, userController.postChangePassword);

router.get("/cart", userAuth, cartController.viewCart);
router.post("/cart/add/:id", userAuth, cartController.addToCart);
router.patch("/cart/update/:id",userAuth,cartController.updateCartQuantity)
router.delete("/cart/remove/:id",userAuth, cartController.removeFromCart)


module.exports = router;
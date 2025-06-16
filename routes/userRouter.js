const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productContrller");
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const walletController = require("../controllers/user/walletController");

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
router.post("/resetPassword", userController.passwordReset);
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), userController.googleCallback);

router.get("/pageNotFound", userAuth, userController.pageNotFound);
router.get("/", userAuth, userController.loadHomepage);
router.get("/products", userAuth, productController.getAllProduct);
router.get("/product/:id", userAuth, productController.getProductDetails);
router.post('/product/:id/review', productController.postReview);
router.get("/wishlist", userAuth, userController.wishlistPage);
router.get('/wishlist', userController.wishlistPage);
router.post('/wishlist/add/:id', userController.addToWishlist);
router.post('/wishlist/remove', userController.removeFromWishlist);
router.get("/logout", userAuth, userController.logout);
router.get("/LoadProfile", userAuth, userController.userDetails);
router.post("/editProfile", userAuth, userController.postEditProfile);
router.get('/address', userAuth, userController.getAddressList);
router.get("/address/add", userAuth, userController.getAddAddress);
router.post('/address', userAuth, userController.postAddress);
router.get('/account/addresses/edit/:addressId', userAuth, userController.loadEdit);
router.put('/address/:id', userAuth, userController.putEditAddress);
router.get('/orders', userAuth, userController.getUserOrders);
router.post('/orders/:id/cancel', userAuth, userController.cancelOrder);
router.get('/changePassword', userAuth, userController.getChangePassword);
router.post('/changePassword', userAuth, userController.postChangePassword);
router.post("/return/:id", userController.requestReturn);
router.post("/admin/return/:returnId/approve", userController.approveReturn);

router.get("/cart", userAuth, cartController.viewCart);
router.post("/cart/add/:id", userAuth, cartController.addToCart);
router.patch("/cart/update/:id",userAuth,cartController.updateCartQuantity)
router.delete("/cart/remove/:id",userAuth, cartController.removeFromCart)

router.get('/wallet', userAuth, walletController.getWallet)
router.post("/wallet/create-order", walletController.createWalletOrder);
router.post("/wallet/verify", walletController.verifyAndCreditWallet);

router.get('/checkout', checkoutController.getCheckoutPage);
router.post('/checkout', checkoutController.postCheckoutPage);
router.post('/create-order', checkoutController.postRazorpay);
router.get('/order/success', checkoutController.orderSuccess);
router.post('/checkout/apply-coupon', checkoutController.applyCoupon);
router.post('/checkout/remove-coupon', checkoutController.removeCoupon);
router.post('/address/select', checkoutController.selectAddress);
router.get('/address/:id', checkoutController.getAddress);
router.post('/address/add', checkoutController.addAddress);
router.post('/address/edit/:id', checkoutController.editAddress);


module.exports = router;
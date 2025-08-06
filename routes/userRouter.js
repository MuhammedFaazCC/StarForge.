const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const walletController = require("../controllers/user/walletController");
const referralController = require("../controllers/user/referralController");

const noCache = require("../middlewares/noCache");
const passport = require("passport");
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
router.post('/wishlist/add/:id', userController.addToWishlist);
router.post('/wishlist/remove', userController.removeFromWishlist);
router.get("/logout", userAuth, userController.logout);
router.get("/LoadProfile", userAuth, userController.userDetails);
router.post("/user/updateProfile", userAuth, userController.upload.single('profileImage'), userController.postEditProfile);
router.post("/profile/upload-image", userAuth, userController.upload.single('profileImage'), userController.uploadProfileImage);
router.post("/profile/remove-image", userAuth, userController.removeProfileImage);
router.get('/address', userAuth, userController.getAddressList);
router.get("/address/add", userAuth, userController.getAddAddress);
router.post('/address', userAuth, userController.postAddress);
router.get('/account/addresses/edit/:addressId', userAuth, userController.loadEdit);
router.put('/address/:id', userAuth, userController.putEditAddress);
router.delete('/address/:id', userAuth, userController.deleteAddress);
router.get('/orders', userAuth, userController.getUserOrders);
router.post('/cancelItem/:orderId/:productId', userAuth, userController.cancelSingleItem);
router.post('/order/cancel/:id', userAuth, userController.cancelOrderNew);
router.post('/order/return/:id', userAuth, userController.returnOrder);
router.get("/orders/:id", userAuth, userController.viewOrderDetails);
router.get("/order/:orderId/invoice", userAuth, userController.downloadInvoice);
router.get('/changePassword', userAuth, userController.getChangePassword);
router.post('/changePassword', userAuth, userController.postChangePassword);
router.post('/returnItem/:orderId/:productId', userAuth, userController.requestReturnItem)
router.post("/return/:id", userAuth, userController.requestReturn);

router.get("/cart", userAuth, cartController.viewCart);
router.post("/cart/add/:id", userAuth, cartController.addToCart);
router.patch("/cart/update/:id",userAuth,cartController.updateCartQuantity)
router.delete("/cart/remove/:id",userAuth, cartController.removeFromCart)

router.get('/wallet', userAuth, walletController.getWallet)
router.post("/wallet/create-order", walletController.createWalletOrder);
router.post("/wallet/verify", walletController.verifyAndCreditWallet);

router.get('/checkout', checkoutController.getCheckoutPage);
router.post('/checkout', checkoutController.postCheckoutPage);
router.get('/order/placed', checkoutController.codSuccess);
router.post('/create-order', checkoutController.postRazorpay);
router.get('/order/success', checkoutController.orderSuccess);
router.get('/order/failure', checkoutController.orderFailure);
router.get('/payment/failure', checkoutController.paymentFailure);
router.post('/order/retry/:orderId', checkoutController.retryPayment);
router.get('/order/view/:id', checkoutController.viewFailedOrder);
router.post('/checkout/apply-coupon', checkoutController.applyCoupon);
router.post('/checkout/remove-coupon', checkoutController.removeCoupon);
router.post('/address/select', checkoutController.selectAddress);
router.get('/address/:id', checkoutController.getAddress);
router.post('/address/add', checkoutController.addAddress);
router.post('/address/edit/:id', checkoutController.editAddress);

router.get('/referral', userAuth, referralController.getReferralDashboard);
router.get('/referral/info', userAuth, referralController.getReferralInfo);
router.get('/referral/validate/:identifier', referralController.validateReferral);

module.exports = router;
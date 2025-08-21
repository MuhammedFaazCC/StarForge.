const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const walletController = require("../controllers/user/walletController");
const referralController = require("../controllers/user/referralController");
const wishlistController = require("../controllers/user/wishlistController");
const addressController = require("../controllers/user/addressController");
const cancelController = require("../controllers/user/cancelController");
const returnController = require("../controllers/user/returnController");
const invoiceController = require("../controllers/user/invoiceController");
const orderController = require("../controllers/user/orderController");
const passwordController = require("../controllers/user/passwordController");
const otpController = require("../controllers/user/otpController");
const signUpController = require("../controllers/user/signUpController");
const profileController = require("../controllers/user/profileController");
const couponController = require("../controllers/user/couponController");

const noCache = require("../middlewares/noCache");
const passport = require("passport");
const { userAuth } = require("../middlewares/auth");

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), userController.googleCallback);

router.get("/login", noCache, userController.loginPage);
router.post("/login", userController.login);
router.get("/pageNotFound", userAuth, userController.pageNotFound);
router.get("/", userAuth, userController.loadHomepage);
router.get("/logout", userAuth, userController.logout);
router.get("/LoadProfile", userAuth, userController.userDetails);

router.get("/products", userAuth, productController.getAllProduct);
router.get("/product/:id", userAuth, productController.getProductDetails);
router.post('/product/:id/review', productController.postReview);

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
router.get('/payment/failure', checkoutController.paymentFailure);
router.post('/order/retry/:orderId', checkoutController.retryPayment);

router.get('/referral', userAuth, referralController.getReferralDashboard);
router.get('/referral/info', userAuth, referralController.getReferralInfo);
router.get('/referral/validate/:id', referralController.validateReferral);

router.get("/wishlist", userAuth, wishlistController.wishlistPage);
router.post('/wishlist/add/:id', wishlistController.addToWishlist);
router.post('/wishlist/remove', wishlistController.removeFromWishlist);

router.get('/address', userAuth, addressController.getAddressList);
router.get("/address/add", userAuth, addressController.getAddAddress);
router.post('/address', userAuth, addressController.addAddress);
router.put('/address/:id', userAuth, addressController.editAddress);
router.delete('/address/:id', userAuth, addressController.deleteAddress);

router.post('/cancelItem/:orderId/:productId', userAuth, cancelController.cancelSingleItem);
router.post('/order/cancel/:id', userAuth, cancelController.cancelOrderNew);

router.post('/returnItem/:orderId/:productId', userAuth, returnController.requestReturnItem)
router.post("/return/:id", userAuth, returnController.requestReturn);

router.get("/order/:orderId/invoice", userAuth, invoiceController.downloadInvoice);

router.get('/orders', userAuth, orderController.getUserOrders);
router.post('/order/return/:id', userAuth, orderController.returnOrder);
router.get("/orders/:id", userAuth, orderController.viewOrderDetails);
router.get('/order/success', orderController.orderSuccess);
router.get('/order/failure', orderController.orderFailure);
router.get('/order/view/:id', orderController.viewFailedOrder);

router.get("/forgotPassword", passwordController.forgotPasswordPage);
router.post("/forgotPassword", passwordController.forgotPassword);
// router.get("/resetPassword", userController.resetPassword);
// router.post("/resetPassword", userController.passwordReset);
router.get('/changePassword', userAuth, passwordController.getChangePassword);
router.post('/changePassword', userAuth, passwordController.postChangePassword);

router.get("/otp-verification", otpController.otpVerificationPage);
router.post("/otp-verification", otpController.verifyOTP);

router.get("/signup", signUpController.signUpPage);
router.post("/signup", signUpController.signUp);

router.post("/user/updateProfile", userAuth, profileController.upload.single("profileImage"), profileController.postEditProfile);
router.post("/profile/upload-image", userAuth, profileController.upload.single("profileImage"), profileController.uploadProfileImage);
router.post("/profile/remove-image", userAuth, profileController.removeProfileImage);

router.post('/checkout/apply-coupon', couponController.applyCoupon);
router.post('/checkout/remove-coupon', couponController.removeCoupon);

router.post('/address/select', addressController.selectAddress);
router.get('/address/:id', addressController.getAddress);
router.post('/address/add', addressController.addAddress);
router.post('/address/edit/:id', addressController.editAddress);

module.exports = router;
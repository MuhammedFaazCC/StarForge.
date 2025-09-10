const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/couponSchema");

const applyCoupon = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ success: false, message: "Please log in to apply a coupon" });
    }

    const { code } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon code" });
    }

    if (coupon.status !== 'Active' || coupon.expiryDate < new Date()) {
      return res.json({ success: false, message: "Coupon is expired or inactive" });
    }

    const userCoupon = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
    if (userCoupon && userCoupon.usedCount >= coupon.usageLimit) {
      return res.json({ success: false, message: "Coupon usage limit reached" });
    }

    if (req.session.coupon && req.session.coupon.code === coupon.code) {
      return res.json({ success: false, message: "Coupon already applied" });
    }

    const subtotal = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);
    
    if (coupon.minimumAmount && subtotal < coupon.minimumAmount) {
      return res.json({ 
        success: false, 
        message: `Minimum order amount of ₹${coupon.minimumAmount.toLocaleString('en-IN')} required for this coupon. Current cart total: ₹${subtotal.toLocaleString('en-IN')}` 
      });
    }

    const discountAmount = (subtotal * coupon.discount) / 100;
    const grandTotal = subtotal - discountAmount;

    req.session.coupon = {
      code: coupon.code,
      discount: coupon.discount,
      discountAmount
    };

    res.json({
      success: true,
      subtotal,
      discount: discountAmount,
      grandTotal,
      coupon: { code: coupon.code, discount: coupon.discount },
      message: `Coupon "${coupon.code}" applied successfully! You saved ₹${discountAmount.toLocaleString('en-IN')}`
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.json({ success: false, message: "Server error" });
  }
};

const removeCoupon = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ success: false, message: "Please log in to remove a coupon" });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    req.session.coupon = null;
    const subtotal = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salesPrice), 0);

    res.json({
      success: true,
      subtotal,
      discount: 0,
      grandTotal: subtotal
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.json({ success: false, message: "Server error" });
  }
};

module.exports = {
    applyCoupon,
    removeCoupon
}
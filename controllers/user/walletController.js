const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Razorpay = require('razorpay');
const crypto = require("crypto");

const getWallet = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    const walletHistory = await Wallet.find({ userId }).sort({ date: -1 });

    res.render("profileWallet", {
      user: {
        fullName: user.fullName,
        walletBalance: user.wallet.balance || 0,
      },
      walletHistory,
      currentPage: "wallet",
    });
  } catch (error) {
    console.error("Error fetching wallet page:", error);
    res.status(500).json({ error: "Unable to load wallet at the moment." });
  }
};

const updateWallet = async (userId, amount, description, type) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    user.wallet.balance = (user.wallet.balance || 0) + (type === "Credit" ? amount : -amount);
    await user.save();

    await Wallet.create({
      userId,
      date: new Date(),
      description,
      type,
      amount,
    });
  } catch (error) {
    console.error("Error updating wallet:", error);
    throw error;
  }
};

const createWalletOrder = async (req, res) => {
    
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.json({ success: false, error: "Invalid amount" });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "wallet_order_" + Date.now(),
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Error creating Razorpay wallet order:", err);
    res.json({ success: false, error: "Razorpay order creation failed" });
  }
};

const verifyAndCreditWallet = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const userId = req.session.user._id;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    await updateWallet(userId, parseFloat(amount), "Wallet Top-up via Razorpay", "Credit");
    res.json({ success: true });
  } catch (err) {
    console.error("Error verifying wallet top-up:", err);
    res.status(500).json({ error: "Verification failed" });
  }
};

module.exports = {
    getWallet,
    updateWallet,
    createWalletOrder,
    verifyAndCreditWallet,
}
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Razorpay = require('razorpay');
const crypto = require("crypto");

const getCartCount = async (userId) => {
  try {
    if (!userId) return 0;
    const cart = await Cart.findOne({ userId });
    return cart ? cart.items.length : 0;
  } catch (error) {
    console.error("Error getting cart count:", error);
    return 0;
  }
};

const getWallet = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] };
      await user.save();
    }

    const walletHistory = user.wallet.transactions ? 
      user.wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

    const cartCount = await getCartCount(userId);

    res.render("profileWallet", {
      user: {
        fullName: user.fullName,
        walletBalance: user.wallet.balance || 0,
        _id: user._id
      },
      walletHistory,
      currentPage: "wallet",
      cartCount
    });
  } catch (error) {
    console.error("Error fetching wallet page:", error);
    res.status(500).json({ error: "Unable to load wallet at the moment." });
  }
};

// const updateWallet = async (userId, amount, description, type) => {
//   try {
//     const user = await User.findById(userId);
//     if (!user) throw new Error("User not found");
    
//     if (!user.wallet) {
//       user.wallet = { balance: 0, transactions: [] };
//     }
    
//     const currentBalance = user.wallet.balance || 0;
//     const transactionAmount = type === "Credit" || type === "credit" ? amount : -amount;
//     user.wallet.balance = currentBalance + transactionAmount;
    
//     user.wallet.transactions.push({
//       amount: Math.abs(amount),
//       type: type.toLowerCase(),
//       description: description,
//       date: new Date()
//     });
    
//     await user.save();
    
//     console.log(`Wallet updated for user ${userId}: ${type} ₹${amount} - ${description}`);
//   } catch (error) {
//     console.error("Error updating wallet:", error);
//     throw error;
//   }
// };

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

// const refundToWallet = async (order, reason = "Refund") => {
//   try {
//     const eligibleForRefund = 
//       order.paymentMethod === "Wallet" ||
//       order.paymentMethod === "Online" ||
//       (order.paymentMethod === "COD" && order.status === "Returned");

//     if (!eligibleForRefund) return;

//     const refundAmount = order.totalAmount;
//     if (!refundAmount || refundAmount <= 0) return;

//     await updateWallet(
//       order.userId,
//       refundAmount,
//       `${reason} - Order #${order._id}`,
//       "Credit"
//     );
//   } catch (err) {
//     console.error("Refund to wallet failed:", err);
//   }
// };



module.exports = {
    getWallet,
    // updateWallet,
    createWalletOrder,
    verifyAndCreditWallet,
    // refundToWallet
  }
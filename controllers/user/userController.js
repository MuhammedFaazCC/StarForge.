const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wishlist = require("../../models/wishlistSchema");
const Return = require("../../models/returnSchema");
const Product = require("../../models/productSchema");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: "SSLv3",
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Transporter Error:", error.message);
  } else {
    console.log("SMTP Transporter is ready");
  }
});

const pageNotFound = async (req, res) => {
  try {
    return res.render("pageNotFound", { user: res.locals.userData });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = res.locals.userData;
    const products = await Product.find({
      isListed: true,
      isDeleted: false,
      stock: { $gt: 0 }
    })
    .populate('category')
    .sort({ createdAt: -1 })
    .limit(6) 
    .select('name price offer categoryOffer salesPrice mainImage stock brand');

    const productsWithFinalPrice = products.map(product => {
      let finalPrice = product.price;
      
      const productOffer = product.offer || 0;
      const categoryOffer = product.categoryOffer || 0;
      const bestOffer = Math.max(productOffer, categoryOffer);
      
      if (bestOffer > 0) {
        finalPrice = product.price - (product.price * bestOffer / 100);
      }
      
      if (product.salesPrice && product.salesPrice < finalPrice) {
        finalPrice = product.salesPrice;
      }
      
      return {
        ...product.toObject(),
        finalPrice: Math.round(finalPrice * 100) / 100,
        hasOffer: bestOffer > 0,
        offerPercentage: bestOffer
      };
    });

    return res.render("landingPage", {
      products: productsWithFinalPrice,
      user,
    });
  } catch (error) {
    console.log("Homepage not found", error);
    
    return res.render("landingPage", {
      products: [],
      user: res.locals.userData,
    });
  }
};

const loginPage = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }

    const error = req.session.error || null;
    req.session.error = null;

    const justLoggedOut = req.session.justLoggedOut || false;
    req.session.justLoggedOut = null;

    return res.render("userLogin", { error, justLoggedOut });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      req.session.error = "Email not found";
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      req.session.error = "Your account has been blocked by an admin";
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.session.error = "Invalid password";
      return res.redirect("/login");
    }

    req.session.user = user;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        req.session.error = "Login failed, please try again";
        return res.redirect("/login");
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.error("Login error:", error);
    req.session.error = "An error occurred";
    res.redirect("/login");
  }
};

const signUpPage = async (req, res) => {
  try {
    const error = req.session.error || null;
    req.session.error = null;
    return res.render("signUp", { error });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const userDetails = async (req, res) => {
  const user = req.session.user;
  const addresses = await Address.find({ userId: user._id });
  const orders = await Order.find({ userId: user._id });
  res.render("userProfile", { user, addresses, orders });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"StarForge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "StarForge OTP Verification",
      html: `
        <h2>Your OTP Code</h2>
        <p>Your one-time password (OTP) is <strong>${otp}</strong>.</p>
        <p>Please enter this code on the verification page to proceed.</p>
        <p>This OTP is valid for 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully. Message ID:", info.messageId);
    console.log(otp);
    return info;
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

const postEditProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { fullName, email, mobile } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (email != req.session.user.email) {
      const otp = generateOTP();
      console.log(otp);
      req.session.otp = {
        code: otp,
        expires: Date.now() + 5 * 60 * 1000,
        userData: { fullName, email, mobile },
        action: "editProfile",
      };
      const sendEmail = await sendOTP(email, otp);
      if (sendEmail) {
        return res.redirect("/otp-verification");
      }
    }
    const newData = await User.findByIdAndUpdate(
      { _id:userId },
      {
        fullName: fullName,
        mobile: mobile,
      },{new:true}
    );
    await newData.save();
    req.session.user = newData;
    res.redirect('/LoadProfile')
  } catch (error) {
    console.log(error)
  }
};



const signUp = async (req, res) => {
  const { fullName, email, mobile, password, confirmPassword, referralCode } =
    req.body;
  try {
    if (
      !fullName ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 50
    ) {
      req.session.error = "Full name must be between 2 and 50 characters";
      return res.redirect("/signup");
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      req.session.error = "Please provide a valid email address";
      return res.redirect("/signup");
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobile || !mobileRegex.test(mobile)) {
      req.session.error = "Mobile number must be exactly 10 digits";
      return res.redirect("/signup");
    }

    if (!password || password.length < 6) {
      req.session.error = "Password must be at least 6 characters";
      return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/signup");
    }

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      req.session.error = "Email or mobile number already exists";
      return res.redirect("/signup");
    }

    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });
      if (!referringUser) {
        req.session.error = "Invalid referral code";
        return res.redirect("/signup");
      }
    }

    const otp = generateOTP();
    console.log(otp);
    req.session.otp = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000,
      userData: { fullName, email, mobile, password, referralCode },
      action: "signup",
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error in signUp:", err);
        req.session.error = "Failed to send OTP. Please try again.";
        return res.redirect("/signup");
      }

      sendOTP(email, otp)
        .then(() => {
          res.redirect("/otp-verification");
        })
        .catch((error) => {
          console.error("Error sending OTP:", error);
          req.session.error = "Failed to send OTP. Please try again.";
          res.redirect("/signup");
        });
    });
  } catch (error) {
    console.error("Error in signUp:", error.message);
    req.session.error = "Failed to send OTP. Please try again.";
    res.redirect("/signup");
  }
};

const forgotPasswordPage = async (req, res) => {
  try {
    const error = req.session.error || null;
    req.session.error = null;
    return res.render("forgotPassword", { error, success: null });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.session.error = "Email not found";
      return res.redirect("/forgotPassword");
    }

    if (user.isBlocked) {
      req.session.error = "Your account has been blocked by an admin";
      return res.redirect("/forgotPassword");
    }

    const otp = generateOTP();
    req.session.otp = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000,
      userId: user._id,
      action: "forgotPassword",
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error in forgotPassword:", err);
        req.session.error = "Failed to send OTP. Please try again.";
        return res.redirect("/forgotPassword");
      }

      sendOTP(email, otp)
        .then(() => {
          res.redirect("/otp-verification");
        })
        .catch((error) => {
          console.error("Error sending OTP:", error);
          req.session.error = "Failed to send OTP. Please try again.";
          res.redirect("/forgotPassword");
        });
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error.message);
    req.session.error = "Failed to send OTP. Please try again.";
    res.redirect("/forgotPassword");
  }
};

const resetPassword = async (req, res) => {
  try {
    if (!req.session.resetUserId) {
      req.session.error = "Reset session expired";
      return res.redirect("/forgotPassword");
    }
    const error = req.session.error || null;
    req.session.error = null;
    res.render("resetPassword", { error });
  } catch (error) {
    console.error("Error rendering reset page:", error);
    res.status(500).send("Server error");
  }
};

const passwordReset = async (req, res) => {
  const { password, confirmPassword } = req.body;

  try {
    if (!req.session.resetUserId) {
      req.session.error = "Reset session expired";
      return res.redirect("/forgotPassword");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/resetPassword");
    }

    if (password.length < 6) {
      req.session.error = "Password must be at least 6 characters";
      return res.redirect("/resetPassword");
    }

    const user = await User.findById(req.session.resetUserId);
    if (!user) {
      req.session.error = "User not found";
      return res.redirect("/resetPassword");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    delete req.session.resetUserId;

    req.session.success =
      "Password reset successfully. Please login with your new password.";
    return res.redirect("/login");
  } catch (error) {
    console.error("Error in resetPasswordPost:", error);
    req.session.error = "Something went wrong. Please try again.";
    res.redirect("/resetPassword");
  }
};

const otpVerificationPage = async (req, res) => {
  try {
    const otpSession = req.session.otp;

    if (!otpSession) {
      req.session.error = "No OTP session found";
      return res.redirect("/login");
    }

    const error = req.session.error || null;
    req.session.error = null;

    const otpAction = otpSession.action;

    res.render("otpVerification", {
      error,
      success: null,
      otpAction,
    });
  } catch (error) {
    console.log("Error rendering OTP page:", error);
    res.status(500).send("Server error");
  }
};

const verifyOTP = async (req, res) => {
  const { otp } = req.body;

  try {
    if (!req.session.otp || !otp) {
      req.session.error = "No OTP session found or OTP not provided";
      return res.redirect("/otp-verification");
    }

    const { code, expires, action } = req.session.otp;

    if (Date.now() > expires) {
      delete req.session.otp;
      req.session.error = "OTP has expired";
      return res.redirect("/otp-verification");
    }

    if (otp !== code) {
      req.session.error = "Invalid OTP";
      return res.redirect("/otp-verification");
    }

    if (action === "signup") {
      const { fullName, email, mobile, password, referralCode } =
        req.session.otp.userData;

      const hashedPassword = await bcrypt.hash(password, 10);
      const newReferralCode = Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase();

      const newUser = await User.create({
        fullName,
        email,
        mobile,
        password: hashedPassword,
        referralCode: newReferralCode,
        role: "customer",
        isActive: true,
      });

      if (referralCode) {
        const referringUser = await User.findOne({ referralCode });
        referringUser.referralPoints = (referringUser.referralPoints || 0) + 50;
        await referringUser.save();
      }

      req.session.user = {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        referralCode: newUser.referralCode,
        isLoggedIn: true,
      };

      delete req.session.otp;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error in verifyOTP (signup):", err);
          req.session.error =
            "Account created but login failed. Please login manually.";
          return res.redirect("/login");
        }
        req.session.success = "Account created successfully!";
        return res.redirect("/");
      });
    } else if (action === "forgotPassword") {
      req.session.resetUserId = req.session.otp.userId;
      delete req.session.otp;

      req.session.save((err) => {
        if (err) {
          console.error(
            "Session save error in verifyOTP (forgot password):",
            err
          );
          req.session.error =
            "Verification successful but session error occurred";
          return res.redirect("/forgotPassword");
        }
        return res.redirect("/resetPassword");
      });
    } else if (action === "editProfile") {
      const { fullName, email, mobile } = req.session.otp.userData;
      const userId = req.session.user._id;
      const newData = await User.findByIdAndUpdate(
        { _id:userId },
        {
          fullName: fullName,
          email: email,
          mobile: mobile,
        },{new:true}
      );
      await newData.save();
      req.session.user = newData;
      res.redirect('/LoadProfile')
    }
  } catch (error) {
    console.error("Error in verifyOTP:", error.message);
    req.session.error = error.message || "An error occurred";
    res.redirect("/otp-verification");
  }
};

const resetPasswordGet = async (req, res) => {
  try {
    if (!req.session.resetUserId) {
      req.session.error = "Reset session expired";
      return res.redirect("/forgotPassword");
    }
    const error = req.session.error || null;
    req.session.error = null;
    res.render("resetPassword", { error });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const resetPasswordPost = async (req, res) => {
  const { password, confirmPassword } = req.body;

  try {
    if (!req.session.resetUserId) {
      req.session.error = "Reset session expired";
      return res.redirect("/forgotPassword");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/resetPassword");
    }

    if (password.length < 6) {
      req.session.error = "Password must be at least 6 characters";
      return res.redirect("/resetPassword");
    }

    const user = await User.findById(req.session.resetUserId);
    if (!user) {
      req.session.error = "User not found";
      return res.redirect("/resetPassword");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    delete req.session.resetUserId;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error in resetPasswordPost:", err);
      }
      req.session.success =
        "Password reset successfully. Please login with your new password.";
      return res.redirect("/login");
    });
  } catch (error) {
    console.error("Error in resetPasswordPost:", error);
    req.session.error = "An error occurred";
    res.redirect("/resetPassword");
  }
};

const wishlistPage = async (req, res) => {
  try {
    const user = res.locals.userData;
    const wishlist = await Wishlist.findOne({ userId: user._id }).populate('items.productId');
    
    const wishlistItems = wishlist?.items.map(item => item.productId) || [];

    res.render("wishlist", {
      user,
      currentPage: "wishlist",
      wishlistItems,
      wishlistCount: wishlistItems.length
    });
  } catch (error) {
    console.error("Wishlist load error:", error);
    res.status(500).send("Server error");
  }
};
const addToWishlist = async (req, res) => {
  const userId = req.session.user._id;
  const productId = req.params.id;

  try {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [{ productId }] });
    } else {
      const index = wishlist.items.findIndex(item => item.productId.toString() === productId);
      if (index > -1) {
        wishlist.items.splice(index, 1);
      } else {
        wishlist.items.push({ productId });
      }
    }

    await wishlist.save();
    res.json({ success: true, message: 'Wishlist updated' });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



const removeFromWishlist = async (req, res) => {
  const userId = req.session.user._id;
  const productId = req.body.productId;

  try {
    await Wishlist.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );
    res.redirect("/wishlist")
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    res.status(500).redirect("/wishlist");
  }
};

const logout = async (req, res) => {
  try {
    delete req.session.user;
    res.clearCookie("connect.sid");
    res.redirect("/login");
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send("Server error");
  }
};


const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      req.session.error = "Login failed. Please try again.";
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      req.session.error = "Your account has been blocked by an admin";
      return res.redirect("/login");
    }

    req.session.user = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      referralCode: user.referralCode,
      isLoggedIn: true,
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error in googleCallback:", err);
        req.session.error = "Login failed, please try again";
        return res.redirect("/login");
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.error("Error in googleCallback:", error);
    req.session.error = "An error occurred";
    res.redirect("/login");
  }
};

const getAddressList = async (req, res) => {
  const user = req.session.user;
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  try {
    const addresses = await Address.find({ userId: user._id }).sort({
      createdAt: -1,
    });

    res.render("profileAddressList", { user, addresses, error, success });
  } catch (err) {
    console.error("Error loading addresses:", err.message);
    res.render("profileAddressList", { user, addresses: [], error: "Failed to load addresses", success: null });
  }
};

const getAddAddress = async (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  res.render("profileAddAddress", {
    currentPage: "address",
    user: req.session.user,
    error,
    success
  });
};

const postAddress = async (req, res) => {
  const user = req.session.user;

  const { name, address, district, state, city, pinCode } = req.body;

  try {
    if (!name || !address || !district || !state || !city || !pinCode) {
      console.error("Missing required fields:", { name, address, district, state, city, pinCode });
      req.session.error = "All fields are required";
      return res.redirect("/address/add");
    }

    if (!/^\d{6}$/.test(pinCode)) {
      console.error("Invalid pinCode format:", pinCode);
      req.session.error = "Pin code must be exactly 6 digits";
      return res.redirect("/address/add");
    }

    console.log("Creating address with data:", { userId: user._id, name, address, district, state, city, pinCode });

    const newAddress = await Address.create({
      userId: user._id,
      name,
      address,
      district,
      state,
      city,
      pinCode,
    });

    console.log("Address created successfully:", newAddress._id);
    req.session.success = "Address added successfully";
    res.redirect("/address");
  } catch (err) {
    console.error("Failed to save address:", err);
    req.session.error = "Failed to save address. Please try again.";
    res.redirect("/address/add");
  }
};

const loadEdit = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const address = await Address.findOne({ _id: addressId });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.status(200).json({
      name: address.name,
      mobile: address.mobile || "",
      address: address.address,
      city: address.city,
      state: address.state,
      pincode: address.pinCode,
      isDefault: address.isDefault || false
    });
  } catch (error) {
    console.error("Error fetching address:", error);
    res.status(500).json({ success: false, message: "Error fetching address" });
  }
};


const putEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const { name, mobile, address, pincode, city, state, isDefault } = req.body;

    const updatedData = {
      name,
      mobile,
      address,
      pinCode: pincode,
      city,
      state,
      isDefault: isDefault === 'true' || isDefault === true,
    };

    await Address.findByIdAndUpdate(addressId, updatedData);

    if (updatedData.isDefault) {
      await Address.updateMany(
        { _id: { $ne: addressId }, userId: req.session.user._id },
        { $set: { isDefault: false } }
      );
    }

    res.json({ success: true, message: 'Address updated successfully' });
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const orders = await Order.find({
      userId: userId,
      totalAmount: { $exists: true, $ne: null }
    })
      .sort({ createdAt: -1 })
      .populate('items.productId');

    orders.forEach(order => {
      order.items = order.items.filter(item => {
        if (!item.productId) {
          console.warn(`Null productId in order ${order._id}, item:`, item);
          return false;
        }
        if (!item.status) {
          console.warn(`Missing status for item in order ${order._id}, productId: ${item.productId._id}`);
          item.status = 'Unknown';
        }
        return true;
      });
    });

    res.render("profileOrders", {
      user: req.session.user,
      currentPage: "orders",
      orders: orders
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).render("errorPage", { message: "Unable to load orders at the moment." });
  }
};

const refundToWallet = async (order, reason = "Refund") => {
const { updateWallet } = require("../../controllers/user/walletController");
  try {
    const eligibleForRefund = 
      order.paymentMethod === "Wallet" ||
      order.paymentMethod === "Online" ||
      (order.paymentMethod === "COD" && order.status === "Returned");

    if (!eligibleForRefund) return;

    const refundAmount = order.totalAmount;
    if (!refundAmount || refundAmount <= 0) return;

    await updateWallet(
      order.userId,
      refundAmount,
      `${reason} - Order #${order._id}`,
      "Credit"
    );
  } catch (err) {
    console.error("Refund to wallet failed:", err);
  }
};

const cancelSingleItem = async (req, res) => {
  
  const { orderId, productId } = req.params;
  const userId = req.session.user._id;

  const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
  if (!order) return res.status(404).json({ error: "Order not found" });

  const item = order.items.find(i => i.productId._id.toString() === productId);
  if (!item || item.status !== 'Ordered') return res.status(400).json({ error: "Item not eligible for cancellation" });

  item.status = 'Cancelled';

  if (order.paymentMethod !== 'COD') {
    const refundAmount = item.productId.price * item.quantity;
    await updateWallet(userId, refundAmount, `Refund for cancelled item ${item.productId.name}`, "Credit");
  }

  await order.save();
  res.json({ message: "Item cancelled successfully" });
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!["Processing", "Confirmed"].includes(order.status)) {
      return res.status(400).json({ error: "Order cannot be canceled at this stage" });
    }

    if (order.totalAmount == null || isNaN(order.totalAmount)) {
      return res.status(400).json({ error: "Order total is invalid" });
    }

    order.status = "Canceled";
    await order.save();

    await refundToWallet(order, "Refund for cancelled order");

    res.json({ message: "Order canceled successfully" });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const requestReturnItem = async (req, res) => {
  const { orderId, productId } = req.params;
  const { reason } = req.body;
  const userId = req.session.user._id;

  const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
  if (!order) return res.status(404).json({ error: "Order not found" });

  const item = order.items.find(i => i.productId._id.toString() === productId);
  if (!item || item.status !== 'Delivered') return res.status(400).json({ error: "Item not eligible for return" });

  item.status = 'Return Requested';
  item.returnReason = reason;

  await order.save();
  res.json({ message: "Return request submitted for item" });
};

const requestReturn = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.id;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({ error: "Only delivered orders can be returned" });
    }

    if (order.totalAmount == null || isNaN(order.totalAmount)) {
      return res.status(400).json({ error: "Order total is invalid" });
    }

    const existingReturn = await Return.findOne({ orderId });
    if (existingReturn) {
      return res.status(400).json({ error: "Return request already submitted" });
    }

    await Return.create({
      orderId,
      userId,
      reason,
      status: "Pending",
      requestedAt: new Date(),
    });

    order.status = "Return Requested";
    await order.save();

    res.json({ message: "Return request submitted successfully" });
  } catch (error) {
    console.error("Error requesting return:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status } = req.body;

    const returnRequest = await Return.findById(returnId).populate("orderId");
    if (!returnRequest) {
      return res.status(404).json({ error: "Return request not found" });
    }

    const order = returnRequest.orderId;
    if (!order) {
      return res.status(404).json({ error: "Associated order not found" });
    }

    if (!order.total) {
      return res.status(400).json({ error: "Order total is invalid" });
    }

    returnRequest.status = status;
    returnRequest.updatedAt = new Date();
    await returnRequest.save();

    if (status === "Approved") {
      order.status = "Returned";
      await order.save();

      await refundToWallet(order, "Refund for returned order");

    } else if (status === "Rejected") {
      order.status = "Delivered";
      await order.save();
    }

    res.json({ message: `Return request ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error("Error processing return:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('items.productId');

    if (!order) {
      return res.status(404).render("errorPage", { message: "Order not found" });
    }

    res.render("viewOrder", {
      user: req.session.user,
      order
    });
  } catch (err) {
    console.error("Error loading order details:", err);
    res.status(500).render("errorPage", { message: "Unable to load order details." });
  }
};

const getChangePassword = (req, res) => {
  res.render("profileChangePassword", {
    user: req.session.user,
    error: req.session.error,
    success: req.session.success,
  });
  req.session.error = null;
  req.session.success = null;
};

const postChangePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findById(req.session.user._id);

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      req.session.error = "Incorrect current password.";
      return res.redirect("/changePassword");
    }

    if (newPassword !== confirmPassword) {
      req.session.error = "New passwords do not match.";
      return res.redirect("/changePassword");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    req.session.success = "Password changed successfully.";
    res.redirect("/changePassword");
  } catch (err) {
    console.error(err);
    req.session.error = "Something went wrong. Please try again.";
    res.redirect("/changePassword");
  }
};

module.exports = {
  pageNotFound,
  loadHomepage,
  loginPage,
  login,
  signUpPage,
  signUp,
  userDetails,
  postEditProfile,
  forgotPasswordPage,
  forgotPassword,
  resetPassword,
  passwordReset,
  otpVerificationPage,
  verifyOTP,
  resetPasswordGet,
  resetPasswordPost,
  wishlistPage,
  addToWishlist,
  removeFromWishlist,
  logout,
  googleCallback,
  getAddressList,
  getAddAddress,
  loadEdit,
  postAddress,
  putEditAddress,
  getUserOrders,
  refundToWallet,
  cancelSingleItem,
  cancelOrder,
  viewOrderDetails,
  getChangePassword,
  postChangePassword,
  requestReturnItem,
  requestReturn,
  approveReturn,
};
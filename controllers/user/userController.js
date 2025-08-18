const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdf = require("html-pdf");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wishlist = require("../../models/wishlistSchema");
const Return = require("../../models/returnSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      const uploadPath = path.join(process.cwd(), 'public/uploads/profiles');
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

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

transporter.verify((error) => {
  if (error) {
    console.error("SMTP Transporter Error:", error.message);
  } else {
    console.log("SMTP Transporter is ready");
  }
});

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
    console.error("Homepage loading error:", error);
    
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
    
    const referralToken = req.query.ref;
    let referrerInfo = null;
    
    if (referralToken) {
      try {
        const referringUser = await User.findOne({ 
          referralToken: referralToken,
          isActive: true,
          isBlocked: false 
        }).select('fullName');
        
        if (referringUser) {
          referrerInfo = {
            name: referringUser.fullName,
            token: referralToken
          };
        }
      } catch (err) {
        console.error('Error validating referral token:', err);
      }
    }
    
    return res.render("signUp", { error, referrerInfo });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const userDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }

    const orderCount = await Order.countDocuments({ 
      userId: userId,
      totalAmount: { $exists: true, $ne: null }
    });
    
    const wishlist = await Wishlist.findOne({ userId: userId });
    const wishlistCount = wishlist ? wishlist.items.length : 0;

    const cartCount = await getCartCount(userId);

    const success = req.session.success || null;
    const error = req.session.error || null;
    req.session.success = null;
    req.session.error = null;

    res.render("userProfile", { 
      user: user.toObject(),
      orderCount,
      wishlistCount,
      cartCount,
      success,
      error
    });
  } catch (error) {
    console.error("Error loading user profile:", error);
    req.session.error = "Unable to load profile";
    res.redirect('/');
  }
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
    return info;
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

const postEditProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { name, email, mobile } = req.body;

    if (!name || name.trim().length < 2) {
      req.session.error = "Full name must be at least 2 characters long";
      return res.redirect('/LoadProfile');
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      req.session.error = "Please provide a valid email address";
      return res.redirect('/LoadProfile');
    }

    if (mobile && !/^[0-9]{10}$/.test(mobile)) {
      req.session.error = "Mobile number must be exactly 10 digits";
      return res.redirect('/LoadProfile');
    }

    const user = await User.findById(userId);
    if (!user) {
      req.session.error = "User not found";
      return res.redirect('/LoadProfile');
    }

    let profileImageFilename = user.profileImage;
    if (req.file) {
      if (user.profileImage) {
        const oldImagePath = path.join(process.cwd(), 'public/uploads/profiles', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (deleteError) {
            console.error("Error deleting old profile image:", deleteError);
          }
        }
      }
      profileImageFilename = req.file.filename;
    }

    if (email !== user.email) {
      const existingUser = await User.findOne({ email: email, _id: { $ne: userId } });
      if (existingUser) {
        req.session.error = "Email address is already in use by another account";
        return res.redirect('/LoadProfile');
      }

      const otp = generateOTP();
      req.session.otp = {
        code: otp,
        expires: Date.now() + 5 * 60 * 1000,
        userData: { fullName: name, email, mobile, profileImage: profileImageFilename },
        action: "editProfile",
      };
      
      try {
        await sendOTP(email, otp);
        return res.redirect("/otp-verification");
      } catch (emailError) {
        console.error("Error sending OTP:", emailError);
        req.session.error = "Failed to send verification email. Please try again.";
        return res.redirect('/LoadProfile');
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        fullName: name.trim(),
        mobile: mobile || null,
        profileImage: profileImageFilename,
      },
      { new: true }
    );

    if (!updatedUser) {
      req.session.error = "Failed to update profile";
      return res.redirect('/LoadProfile');
    }

    req.session.user = {
      ...req.session.user,
      fullName: updatedUser.fullName,
      mobile: updatedUser.mobile,
      profileImage: updatedUser.profileImage
    };

    req.session.success = "Profile updated successfully";
    res.redirect('/LoadProfile');

  } catch (error) {
    console.error("Error in postEditProfile:", error);
    req.session.error = "An error occurred while updating profile";
    res.redirect('/LoadProfile');
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
      
      const crypto = require('crypto');
      const referralToken = crypto.randomBytes(32).toString('hex');

      const newUser = await User.create({
        fullName,
        email,
        mobile,
        password: hashedPassword,
        referralCode: newReferralCode,
        referralToken: referralToken,
        role: "customer",
        isActive: true,
      });

      if (referralCode) {
        try {
          const { processReferralSignup } = require('./referralController');
          await processReferralSignup(referralCode, newUser._id);
        } catch (referralError) {
          console.error('Error processing referral:', referralError);
        }
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
      const { fullName, email, mobile, profileImage } = req.session.otp.userData;
      const userId = req.session.user._id;
      
      try {
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          {
            fullName: fullName.trim(),
            email: email,
            mobile: mobile || null,
            profileImage: profileImage,
          },
          { new: true }
        );

        if (!updatedUser) {
          req.session.error = "Failed to update profile";
          return res.redirect('/LoadProfile');
        }

        req.session.user = {
          ...req.session.user,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          mobile: updatedUser.mobile,
          profileImage: updatedUser.profileImage
        };

        delete req.session.otp;
        req.session.success = "Profile updated successfully";
        res.redirect('/LoadProfile');
      } catch (updateError) {
        console.error("Error updating profile after OTP verification:", updateError);
        req.session.error = "Failed to update profile";
        res.redirect('/LoadProfile');
      }
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
    const wishlist = await Wishlist.findOne({ userId: user._id }).populate({
      path: 'items.productId',
      populate: {
        path: 'category',
        select: 'name isActive offer'
      }
    });
    
    let wishlistItems = [];
    
    if (wishlist && wishlist.items) {
      wishlistItems = wishlist.items
        .filter(item => item.productId && item.productId.isListed && !item.productId.isDeleted)
        .map(item => {
          const product = item.productId;
          
          const productOffer = product.offer || 0;
          const categoryOffer = product.category?.offer || 0;
          const bestOffer = Math.max(productOffer, categoryOffer);
          
          let finalPrice = product.price;
          if (bestOffer > 0) {
            finalPrice = product.price - (product.price * bestOffer / 100);
          }
          
          if (product.salesPrice && product.salesPrice < finalPrice) {
            finalPrice = product.salesPrice;
          }
          
          return {
            ...product.toObject(),
            offer: productOffer,
            categoryOffer: categoryOffer,
            bestOffer: bestOffer,
            finalPrice: Math.round(finalPrice * 100) / 100,
            hasOffer: bestOffer > 0
          };
        });
    }

    const cartCount = await getCartCount(user._id);

    res.render("wishlist", {
      user,
      currentPage: "wishlist",
      wishlistItems,
      wishlistCount: wishlistItems.length,
      cartCount
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
    
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'Item removed from wishlist successfully' });
    }
    
    res.redirect("/wishlist");
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Failed to remove item from wishlist' });
    }
    
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

    const cartCount = await getCartCount(user._id);

    res.render("profileAddressList", { user, addresses, error, success, cartCount });
  } catch (err) {
    console.error("Error loading addresses:", err.message);
    res.render("profileAddressList", { user, addresses: [], error: "Failed to load addresses", success: null, cartCount: 0 });
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

  const { name, address, district, state, city, pinCode, mobile, isDefault } = req.body;

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

    if (mobile && !/^\d{10}$/.test(mobile)) {
      req.session.error = "Mobile number must be exactly 10 digits";
      return res.redirect("/address/add");
    }

    if (isDefault === 'on' || isDefault === true) {
      await Address.updateMany(
        { userId: user._id },
        { $set: { isDefault: false } }
      );
    }

    console.log("Creating address with data:", { userId: user._id, name, address, district, state, city, pinCode, mobile, isDefault });

    const newAddress = await Address.create({
      userId: user._id,
      name,
      address,
      district,
      state,
      city,
      pinCode,
      mobile: mobile || undefined,
      isDefault: isDefault === 'on' || isDefault === true || false,
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

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user._id;

    const address = await Address.findOne({ _id: addressId, userId: userId });
    if (!address) {
      return res.status(404).json({ 
        success: false, 
        message: "Address not found or you don't have permission to delete this address" 
      });
    }

    await Address.findByIdAndDelete(addressId);

    res.json({ 
      success: true, 
      message: "Address deleted successfully" 
    });

  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete address. Please try again." 
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({
      userId: userId,
      totalAmount: { $exists: true, $ne: null }
    });

    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({
      userId: userId,
      totalAmount: { $exists: true, $ne: null }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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

    const cartCount = await getCartCount(userId);

    res.render("profileOrders", {
      user: req.session.user,
      currentPage: "orders",
      orders: orders,
      cartCount,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      }
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).render("errorPage", {
      statusCode: 500,
      error: "Unable to load orders at the moment",
      user: req.session.user || null
    });
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
  try {
    console.log("=== CANCEL SINGLE ITEM START ===");
    const { orderId, productId } = req.params;
    const userId = req.session.user._id;

    console.log(`Cancel item request - Order: ${orderId}, Product: ${productId}, User: ${userId}`);

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
      console.error(`Invalid ObjectId format - Order: ${orderId}, Product: ${productId}`);
      return res.status(400).json({ success: false, error: "Invalid order or product ID format" });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
    if (!order) {
      console.error(`Order not found: ${orderId} for user: ${userId}`);
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    console.log(`Order found: ${order._id}, Status: ${order.status}, Items count: ${order.items.length}`);

    const itemIndex = order.items.findIndex(i => {
      if (!i.productId) {
        console.warn(`Item with null productId found in order ${orderId}`);
        return false;
      }
      return i.productId._id.toString() === productId;
    });

    if (itemIndex === -1) {
      console.error(`Item not found in order: ${productId} in order: ${orderId}`);
      return res.status(404).json({ success: false, error: "Item not found in order" });
    }

    const item = order.items[itemIndex];
    console.log(`Item found: ${item.productId.name}, Current Status: ${item.status || 'Ordered'}`);
    
    // Enhanced cancellation logic - allow cancellation for pending, shipped, and ordered items
    const cancellableStatuses = ['Placed', 'Ordered', 'Processing', 'Shipped'];
    const currentStatus = item.status || 'Placed';
    
    if (!cancellableStatuses.includes(currentStatus)) {
      console.error(`Item cannot be cancelled, current status: ${currentStatus}`);
      return res.status(400).json({ 
        success: false, 
        error: `Item cannot be cancelled. Current status: ${currentStatus}` 
      });
    }

    // Simple direct cancellation without complex coupon logic for now
    console.log("Updating item status directly...");
    
    // Update the item status
    item.status = 'Cancelled';
    item.cancelledAt = new Date();
    item.cancellationReason = 'User requested cancellation';
    
    // Calculate refund amount
    const refundAmount = item.salesPrice * item.quantity;
    
    // Check if all items will be cancelled
    const otherActiveItems = order.items.filter(i => 
      i.productId._id.toString() !== productId && 
      (i.status || 'Ordered') !== 'Cancelled'
    );
    
    const willBeFullyCancelled = otherActiveItems.length === 0;
    
    if (willBeFullyCancelled) {
      console.log("All items will be cancelled, updating order status...");
      order.status = 'Cancelled';
    }
    
    // Update order total
    order.totalAmount = order.totalAmount - refundAmount;
    
    console.log("Saving order...");
    await order.save();
    
    // Process wallet refund if needed
    if (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') {
      try {
        console.log(`Processing wallet refund of ₹${refundAmount}`);
        const { updateWallet } = require("./walletController");
        await updateWallet(
          userId, 
          refundAmount, 
          `Refund for cancelled item: ${item.productId.name} from order #${order._id}`, 
          "Credit"
        );
        console.log("Wallet refund processed successfully");
      } catch (refundError) {
        console.error("Wallet refund failed:", refundError);
        // Continue even if refund fails
      }
    }
    
    // Restore product stock
    try {
      console.log(`Restoring stock for product ${item.productId._id}: +${item.quantity}`);
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: item.quantity } }
      );
      console.log("Stock restored successfully");
    } catch (stockError) {
      console.error("Stock restoration failed:", stockError);
      // Continue even if stock restoration fails
    }
    
    // Verify the changes were saved
    const verifyOrder = await Order.findById(orderId);
    const verifyItem = verifyOrder.items.find(i => i.productId.toString() === productId);
    
    console.log(`Verification - Item status: ${verifyItem.status}, Order status: ${verifyOrder.status}`);
    
    if (verifyItem.status !== 'Cancelled') {
      console.error("Verification failed - item status not updated");
      return res.status(500).json({ 
        success: false, 
        error: "Status update failed. Please try again." 
      });
    }

    let message = "Item cancelled successfully";
    if (order.paymentMethod !== 'COD') {
      message += ". Refund has been processed to your wallet";
    }
    
    if (willBeFullyCancelled) {
      message += ". Order has been fully cancelled";
    }

    console.log("=== CANCEL SINGLE ITEM SUCCESS ===");

    res.json({ 
      success: true, 
      message: message,
      refundAmount: (order.paymentMethod !== 'COD') ? refundAmount : 0,
      newOrderTotal: order.totalAmount,
      orderFullyCancelled: willBeFullyCancelled,
      itemStatus: 'Cancelled',
      orderStatus: verifyOrder.status
    });

  } catch (error) {
    console.error("=== ERROR IN CANCEL SINGLE ITEM ===");
    console.error("Error cancelling item:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("=== END ERROR LOG ===");
    
    res.status(500).json({ 
      success: false, 
      error: "Internal server error. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const requestReturnItem = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user._id;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a detailed reason for return (minimum 10 characters)" 
      });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    const item = order.items.find(i => i.productId._id.toString() === productId);
    if (!item || item.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: "Item not eligible for return" 
      });
    }

    // Check return time limit (7 days from delivery)
    const RETURN_DAYS_LIMIT = 7;
    const deliveryDate = item.deliveredAt || order.deliveredAt;
    if (!deliveryDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Delivery date not found for this item" 
      });
    }

    const daysSinceDelivery = Math.floor((new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > RETURN_DAYS_LIMIT) {
      return res.status(400).json({ 
        success: false, 
        message: `Return period has expired. Items can only be returned within ${RETURN_DAYS_LIMIT} days of delivery.` 
      });
    }

    if (item.status === 'Return Requested') {
      return res.status(400).json({ 
        success: false, 
        message: "Return request already submitted for this item" 
      });
    }

    item.status = 'Return Requested';
    item.returnReason = reason.trim();
    item.returnRequestedAt = new Date();

    await order.save();
    
    res.json({ 
      success: true, 
      message: "Return request submitted for item successfully. We will review your request and get back to you soon." 
    });

  } catch (error) {
    console.error("Error processing item return request:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
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
    
    // Force fresh data from database by using lean() and then re-querying
    const order = await Order.findOne({ _id: orderId, userId })
      .populate('items.productId')
      .lean(); // Use lean() to get plain JavaScript object

    if (!order) {
      return res.status(500).render("errorPage", {
        statusCode: 500,
        error: "Order not found",
        user: req.session.user || null,
      });
    }

    // Debug logging to check item statuses
    console.log(`Order ${orderId} status: ${order.status}`);
    order.items.forEach((item, index) => {
      console.log(`Item ${index}: ${item.productId?.name || 'Unknown'} - Status: ${item.status || 'Ordered'}`);
    });

    const discountAmount = order?.coupon?.discountAmount || 0;
    
    const totalSales = order.items.reduce((sum, item) => {
      return sum + item.salesPrice * item.quantity;
    }, 0);

    const itemsWithAdjustedPrice = order.items.map(item => {
      const itemTotal = item.salesPrice * item.quantity;
      const shareOfDiscount = (itemTotal / totalSales) * discountAmount;
      const adjustedTotal = itemTotal - shareOfDiscount;
      const adjustedUnitPrice = adjustedTotal / item.quantity;

      return {
        ...item,
        adjustedUnitPrice: adjustedUnitPrice
      };
    });

    const modifiedOrder = {
      ...order,
      items: itemsWithAdjustedPrice
    };

    res.render("userOrderDetails", {
      user: req.session.user,
      order: modifiedOrder
    });

  } catch (err) {
    console.error("Error loading order details:", err);
    res.status(500).render("errorPage", {
      statusCode: 500,
      error: "Unable to load order details",
      user: req.session.user || null,
    });
  }
};

const getChangePassword = async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    const cartCount = await getCartCount(userId);

    res.render("profileChangePassword", {
      user: req.session.user,
      error: req.session.error,
      success: req.session.success,
      cartCount
    });
    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Error loading change password page:", error);
    res.render("profileChangePassword", {
      user: req.session.user,
      error: req.session.error,
      success: req.session.success,
      cartCount: 0
    });
    req.session.error = null;
    req.session.success = null;
  }
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

const cancelOrderNew = async (req, res) => {
  try {
    console.log("=== CANCEL ORDER START ===");
    const userId = req.session.user._id;
    const orderId = req.params.id;

    console.log(`Cancel order request - Order: ${orderId}, User: ${userId}`);

    const order = await Order.findOne({ _id: orderId, userId: userId }).populate('items.productId');
    if (!order) {
      console.error(`Order not found: ${orderId} for user: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or you don't have permission to cancel this order" 
      });
    }

    const validCancelStatuses = ['Pending', 'Placed', 'Processing'];
    if (!validCancelStatuses.includes(order.status)) {
      console.error(`Order cannot be cancelled, current status: ${order.status}`);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled. Current status: ${order.status}` 
      });
    }

    console.log(`Order found: ${order._id}, Status: ${order.status}, Items count: ${order.items.length}`);

    // Get items that can be cancelled
    const itemsToCancel = order.items.filter(item => (item.status || 'Ordered') !== 'Cancelled');

    if (itemsToCancel.length === 0) {
      console.error(`No items available for cancellation in order: ${orderId}`);
      return res.status(400).json({ 
        success: false, 
        message: "No items available for cancellation" 
      });
    }

    console.log(`Processing full order cancellation for ${itemsToCancel.length} items`);

    // Calculate total refund amount
    let totalRefundAmount = 0;
    
    // Update all item statuses to cancelled
    for (const item of itemsToCancel) {
      item.status = 'Cancelled';
      item.cancelledAt = new Date();
      item.cancellationReason = 'Full order cancellation';
      totalRefundAmount += item.salesPrice * item.quantity;
      
      // Restore product stock
      try {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { stock: item.quantity } }
        );
        console.log(`Stock restored for product ${item.productId._id}: +${item.quantity}`);
      } catch (stockError) {
        console.error(`Stock restoration failed for product ${item.productId._id}:`, stockError);
      }
    }
    
    // Update order status
    order.status = 'Cancelled';
    order.totalAmount = 0; // Set to 0 since everything is cancelled
    
    console.log("Saving order with cancelled status...");
    await order.save();
    
    // Process wallet refund if needed
    if (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') {
      try {
        console.log(`Processing wallet refund of ₹${totalRefundAmount}`);
        const { updateWallet } = require("./walletController");
        await updateWallet(
          userId, 
          totalRefundAmount, 
          `Refund for cancelled order #${order._id}`, 
          "Credit"
        );
        console.log("Wallet refund processed successfully");
      } catch (refundError) {
        console.error("Wallet refund failed:", refundError);
        // Continue even if refund fails
      }
    }
    
    // Verify the changes were saved
    const verifyOrder = await Order.findById(orderId);
    console.log(`Verification - Order status: ${verifyOrder.status}`);
    
    if (verifyOrder.status !== 'Cancelled') {
      console.error("Verification failed - order status not updated");
      return res.status(500).json({ 
        success: false, 
        message: "Order status update failed. Please try again." 
      });
    }

    let message = "Order cancelled successfully";
    if (order.paymentMethod !== 'COD') {
      message += ". Refund has been processed to your wallet";
    }

    console.log("=== CANCEL ORDER SUCCESS ===");

    res.json({ 
      success: true, 
      message: message,
      refundAmount: (order.paymentMethod !== 'COD') ? totalRefundAmount : 0,
      orderFullyCancelled: true,
      orderStatus: 'Cancelled',
      cancelledItemsCount: itemsToCancel.length
    });

  } catch (error) {
    console.error("=== ERROR IN CANCEL ORDER ===");
    console.error("Error cancelling order:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    console.error("=== END ERROR LOG ===");
    
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
};

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a detailed reason for return (minimum 10 characters)" 
      });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or you don't have permission to return this order" 
      });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: `Only delivered orders can be returned. Current status: ${order.status}` 
      });
    }

    const existingReturn = await Return.findOne({ orderId });
    if (existingReturn) {
      return res.status(400).json({ 
        success: false, 
        message: "Return request has already been submitted for this order" 
      });
    }

    await Return.create({
      orderId,
      userId,
      reason: reason.trim(),
      status: "Pending",
      requestedAt: new Date(),
    });

    order.status = "Return Requested";
    await order.save();

    res.json({ 
      success: true, 
      message: "Return request submitted successfully. We will review your request and get back to you soon." 
    });

  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Please log in to upload profile image" 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No image file provided" 
      });
    }

    const userId = req.session.user._id;
    const filename = req.file.filename;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (user.profileImage) {
      const oldImagePath = path.join(process.cwd(), 'public/uploads/profiles', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (deleteError) {
          console.error("Error deleting old profile image:", deleteError);
        }
      }
    }

    user.profileImage = filename;
    await user.save();

    req.session.user.profileImage = filename;

    res.json({ 
      success: true, 
      message: "Profile image updated successfully",
      imageUrl: `/uploads/profiles/${filename}`
    });

  } catch (error) {
    console.error("Error uploading profile image:", error);
    
    if (req.file) {
      const uploadedFilePath = req.file.path;
      if (fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up uploaded file:", cleanupError);
        }
      }
    }

    res.status(500).json({ 
      success: false, 
      message: "Failed to upload profile image. Please try again." 
    });
  }
};

const removeProfileImage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Please log in to remove profile image" 
      });
    }

    const userId = req.session.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (!user.profileImage) {
      return res.status(400).json({ 
        success: false, 
        message: "No profile image to remove" 
      });
    }

    const imagePath = path.join(process.cwd(), 'public/uploads/profiles', user.profileImage);
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (deleteError) {
        console.error("Error deleting profile image file:", deleteError);
      }
    }

    user.profileImage = null;
    await user.save();

    req.session.user.profileImage = null;

    res.json({ 
      success: true, 
      message: "Profile image removed successfully"
    });

  } catch (error) {
    console.error("Error removing profile image:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to remove profile image. Please try again." 
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user._id;

    // Fetch the order with populated product details
    const order = await Order.findOne({ _id: orderId, userId })
      .populate('items.productId')
      .populate('userId');

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    // Debug logging to see the actual order structure
    console.log('Order items structure:', JSON.stringify(order.items, null, 2));

    // Calculate totals
    const discountAmount = order?.coupon?.discountAmount || 0;
    const totalSales = order.items.reduce((sum, item) => {
      return sum + (item.salesPrice || 0) * (item.quantity || 0);
    }, 0);

    // Calculate adjusted prices for items (considering coupon discount)
    const itemsWithAdjustedPrice = order.items.map(item => {
      // Debug each item
      console.log('Processing item:', {
        name: item.name,
        quantity: item.quantity,
        salesPrice: item.salesPrice,
        productId: item.productId
      });

      const itemTotal = (item.salesPrice || 0) * (item.quantity || 0);
      const shareOfDiscount = totalSales > 0 ? (itemTotal / totalSales) * discountAmount : 0;
      const adjustedTotal = itemTotal - shareOfDiscount;
      const adjustedUnitPrice = item.quantity > 0 ? adjustedTotal / item.quantity : 0;

      return {
        name: item.name,
        quantity: item.quantity,
        salesPrice: item.salesPrice,
        productId: item.productId,
        status: item.status,
        adjustedUnitPrice: adjustedUnitPrice,
        adjustedTotal: adjustedTotal
      };
    });

    // Generate HTML for the invoice
    const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${order._id}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border: 1px solid #ddd;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #fca120;
          padding-bottom: 20px;
        }
        .company-name {
          font-size: 32px;
          font-weight: bold;
          color: #fca120;
          margin-bottom: 5px;
        }
        .invoice-title {
          font-size: 24px;
          color: #333;
          margin-top: 15px;
        }
        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .invoice-details, .billing-details {
          width: 48%;
        }
        .invoice-details h3, .billing-details h3 {
          color: #fca120;
          margin-bottom: 10px;
          font-size: 16px;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
        }
        .detail-row {
          margin-bottom: 8px;
          display: flex;
        }
        .detail-label {
          font-weight: bold;
          width: 120px;
          color: #555;
        }
        .detail-value {
          color: #333;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
        }
        .items-table th {
          background-color: #fca120;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
        }
        .items-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #eee;
        }
        .items-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .totals-section {
          margin-top: 30px;
          border-top: 2px solid #fca120;
          padding-top: 20px;
        }
        .totals-table {
          width: 100%;
          max-width: 400px;
          margin-left: auto;
        }
        .totals-table td {
          padding: 8px 15px;
          border-bottom: 1px solid #eee;
        }
        .totals-table .total-label {
          font-weight: bold;
          text-align: right;
          color: #555;
        }
        .totals-table .total-value {
          text-align: right;
          font-weight: bold;
          color: #333;
        }
        .final-total {
          background-color: #fca120;
          color: white;
          font-size: 18px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #eee;
          color: #666;
          font-size: 12px;
        }
        .payment-method {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #fca120;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .status-delivered {
          background-color: #d4edda;
          color: #155724;
        }
        .status-cancelled {
          background-color: #f8d7da;
          color: #721c24;
        }
        .status-pending {
          background-color: #fff3cd;
          color: #856404;
        }
        .status-processing {
          background-color: #cce7ff;
          color: #004085;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-name">StarForge</div>
          <div class="invoice-title">INVOICE</div>
        </div>

        <!-- Invoice and Billing Information -->
        <div class="invoice-info">
          <div class="invoice-details">
            <h3>Invoice Details</h3>
            <div class="detail-row">
              <span class="detail-label">Invoice No:</span>
              <span class="detail-value">${order._id}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${order.createdAt.toLocaleDateString('en-GB')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value">
                <span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span>
              </span>
            </div>
          </div>
          
          <div class="billing-details">
            <h3>Billing To</h3>
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${order.userId.fullName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${order.userId.email}</span>
            </div>
            ${order.userId.mobile ? `
            <div class="detail-row">
              <span class="detail-label">Mobile:</span>
              <span class="detail-value">${order.userId.mobile}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Address:</span>
              <span class="detail-value">${order.address}</span>
            </div>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="payment-method">
          <strong>Payment Method:</strong> 
          ${order.paymentMethod === 'Online' ? 'Razorpay (Online Payment)' : 
            order.paymentMethod === 'COD' ? 'Cash on Delivery' : 
            order.paymentMethod === 'Wallet' ? 'Wallet Payment' : order.paymentMethod}
        </div>

        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th class="text-center">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody${itemsWithAdjustedPrice.map(item => `
              <tr>
                <td>
                  <strong>${item.name || 'Unknown Product'}</strong>
                  ${item.status && item.status !== 'Ordered' ? `<br><span class="status-badge status-${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span>` : ''}
                </td>
                <td class="text-center">${item.quantity || 0}</td>
                <td class="text-right">₹${(item.adjustedUnitPrice || 0).toFixed(2)}</td>
                <td class="text-right">₹${(item.adjustedTotal || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals Section -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="total-label">Subtotal:</td>
              <td class="total-value">₹${(order.totalAmount + discountAmount).toFixed(2)}</td>
            </tr>
            ${discountAmount > 0 ? `
            <tr>
              <td class="total-label">Discount (${order.coupon?.code || 'Coupon'}):</td>
              <td class="total-value">-₹${discountAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="final-total">
              <td class="total-label">Total Paid:</td>
              <td class="total-value">₹${order.totalAmount.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p><strong>Thank you for your business!</strong></p>
          <p>This is a computer-generated invoice.</p>
          <p>For any queries, please contact our support team.</p>
          <p>StarForge - Your trusted electronics partner</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // PDF generation options
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      header: {
        height: '0mm'
      },
      footer: {
        height: '0mm'
      }
    };

    // Generate PDF
    pdf.create(invoiceHTML, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('PDF generation error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to generate invoice PDF' 
        });
      }

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order._id}.pdf"`);
      res.setHeader('Content-Length', buffer.length);

      // Send the PDF buffer
      res.send(buffer);
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while generating invoice' 
    });
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
  deleteAddress,
  getUserOrders,
  refundToWallet,
  cancelSingleItem,
  viewOrderDetails,
  getChangePassword,
  postChangePassword,
  requestReturnItem,
  requestReturn,
  approveReturn,
  cancelOrderNew,
  returnOrder,
  upload,
  uploadProfileImage,
  removeProfileImage,
  downloadInvoice,
};
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const User = require("../../models/userSchema");

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

    const products = [
      { name: "StarForge Classic", price: 5000, image: "/images/wheel1.jpg" },
      { name: "StarForge Omega", price: 6500, image: "/images/wheel2.jpg" },
      { name: "StarForge Rage", price: 7200, image: "/images/wheel3.jpg" },
      { name: "StarForge Titan", price: 8000, image: "/images/wheel4.jpg" },
      { name: "StarForge Nitro", price: 9000, image: "/images/wheel5.jpg" },
      { name: "StarForge Phantom", price: 7800, image: "/images/wheel6.jpg" },
    ];

    return res.render("landingPage", {
      products,
      user,
    });
  } catch (error) {
    console.log("Homepage not found", error);
    res.status(500).send("Server error");
  }
};

const loginPage = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }
    const error = req.session.error || null;
    req.session.error = null;
    return res.render("userLogin", { error });
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

    req.session.user = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      referralCode: user.referralCode,
      isBlocked: user.isBlocked,
      isLoggedIn: true,
    };

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
    return info;
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

const signUp = async (req, res) => {
  const { fullName, email, mobile, password, confirmPassword, referralCode } = req.body;
  try {
    if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 50) {
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
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
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
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
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

const otpVerificationPage = async (req, res) => {
  try {
    const otpSession = req.session.otp;

    if (!otpSession) {
      req.session.error = "No OTP session found";
      return res.redirect("/login"); // fallback safe redirect
    }

    const error = req.session.error || null;
    req.session.error = null;

    const otpAction = otpSession.action;

    res.render("otpVerification", {
      error,
      success: null,
      otpAction
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
      const { fullName, email, mobile, password, referralCode } = req.session.otp.userData;

      const hashedPassword = await bcrypt.hash(password, 10);
      const newReferralCode = Math.random().toString(36).slice(2, 10).toUpperCase();

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
          req.session.error = "Account created but login failed. Please login manually.";
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
          console.error("Session save error in verifyOTP (forgot password):", err);
          req.session.error = "Verification successful but session error occurred";
          return res.redirect("/forgotPassword");
        }
        return res.redirect("/resetPassword");
      });
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
      req.session.success = "Password reset successfully. Please login with your new password.";
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
    const wishlistItems = [
      {
        id: 1,
        name: "Black forged alloy wheels",
        price: 1999,
        image: "https://via.placeholder.com/150",
      },
      {
        id: 2,
        name: "Black forged alloy wheels",
        price: 1999,
        image: "https://via.placeholder.com/150",
      },
    ];
    res.render("wishlist", {
      user,
      currentPage: "wishlist",
      wishlistItems: wishlistItems,
      wishlistCount: wishlistItems.length,
    });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const cartPage = async (req, res) => {
  try {
    const user = res.locals.userData;
    const cartItems = [
      {
        name: "Lightweight Silver Alloys",
        price: "USD $220.00",
        discount: "USD $100",
        quantity: 1,
        image: "path/to/silver-alloys.jpg",
      },
      {
        name: "Turquoise Checks Linen Blend Shirt",
        price: "USD $230.00",
        discount: "",
        quantity: 1,
        image: "path/to/turquoise-shirt.jpg",
      },
    ];
    const subtotal = 450.0;
    const discountedSubtotal = 407.0;
    res.render("cart", { user, cartItems, subtotal, discountedSubtotal });
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.redirect("/");
      }
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  } catch (error) {
    console.log("Error during logout", error);
    res.status(500).send("Server error");
  }
};

const googleCallback = async (req, res) => {
  const profile = req.user;
  try {
    let user = await User.findOne({ email: profile.emails[0].value });
    if (!user) {
      user = await User.create({
        fullName: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        role: "customer",
        referralCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
      });
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

module.exports = {
  pageNotFound,
  loadHomepage,
  loginPage,
  login,
  signUpPage,
  signUp,
  forgotPasswordPage,
  forgotPassword,
  otpVerificationPage,
  verifyOTP,
  resetPasswordGet,
  resetPasswordPost,
  wishlistPage,
  cartPage,
  logout,
  googleCallback,
};
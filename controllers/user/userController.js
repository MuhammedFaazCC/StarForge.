const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const User = require("../../models/userSchema");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const pageNotFound = async (req, res) => {
  try {
    return res.render("pageNotFound");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadHomepage = async (req, res) => {
  try {
    const products = [
      { name: "StarForge Classic", price: 5000, image: "/images/wheel1.jpg" },
      { name: "StarForge Omega", price: 6500, image: "/images/wheel2.jpg" },
      { name: "StarForge Rage", price: 7200, image: "/images/wheel3.jpg" },
      { name: "StarForge Titan", price: 8000, image: "/images/wheel4.jpg" },
      { name: "StarForge Nitro", price: 9000, image: "/images/wheel5.jpg" },
      { name: "StarForge Phantom", price: 7800, image: "/images/wheel6.jpg" },
    ];

    let user = null;
    if (req.session.user) {
      user = await User.find(req.session.user);
    }

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
    return res.render("userLogin", { error: null });
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
      return res.render("userLogin", { error: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("userLogin", { error: "Invalid password" });
    }

    req.session.user = user;
    res.redirect("/");
  } catch (error) {
    res.render("userLogin", { error: "An error occurred" });
  }
};

const signUpPage = async (req, res) => {
  try {
    return res.render("signUp", { error: null });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
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
      return res.render("signUp", {
        error: "Full name must be between 2 and 50 characters",
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      return res.render("signUp", {
        error: "Please provide a valid email address",
      });
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobile || !mobileRegex.test(mobile)) {
      return res.render("signUp", {
        error: "Mobile number must be exactly 10 digits",
      });
    }

    if (!password || password.length < 6) {
      return res.render("signUp", {
        error: "Password must be at least 6 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.render("signUp", { error: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return res.render("signUp", {
        error: "Email or mobile number already exists",
      });
    }

    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });
      if (!referringUser) {
        return res.render("signUp", { error: "Invalid referral code" });
      }
    }

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
    console.log(newUser);

    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });
      referringUser.referralPoints = (referringUser.referralPoints || 0) + 50;
      await referringUser.save();
    }

    req.session.userId = newUser._id;

    res.redirect("/");
  } catch (error) {
    console.error("Error: ", error);
    res.render("signUp", { error: error.message || "An error occurred" });
  }
};

const forgotPasswordPage = async (req, res) => {
  try {
    return res.render("forgotPassword", { error: null, success: null });
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
      return res.render("forgotPassword", {
        error: "Email not found",
        success: null,
      });
    }

    req.session.resetUserId = user._id;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "StarForge Password Reset Request",
      html: `
                <h2>Password Reset Request</h2>
                <p>We received a request to reset your StarForge account password.</p>
                <p>Please return to the StarForge website and visit the Reset Password page to set a new password.</p>
                <p>If you did not request a password reset, please ignore this email.</p>
            `,
    };

    await transporter.sendMail(mailOptions);

    res.render("forgotPassword", {
      error: null,
      success: "Please check your email for further instructions",
    });
  } catch (error) {
    res.render("forgotPassword", { error: "An error occurred", success: null });
  }
};

const resetPasswordGet = async (req, res) => {
  try {
    if (!req.session.resetUserId) {
      return res.redirect("/forgotPassword");
    }
    res.render("resetPassword", { error: null });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const wishlistPage = async (req, res) => {
  try {
    let user =req.session.user
    let wishlistItems = [
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
// --------------------

/*// POST: Add item to cart (simulated)
router.post("/add-to-cart/:id", (req, res) => {
  const itemId = parseInt(req.params.id);
  // In a real app, you'd add the item to the cart (e.g., in a database or session)
  // For now, we'll just redirect back to the wishlist
  res.redirect("/");
});

// POST: Remove item from wishlist
router.post("/remove/:id", (req, res) => {
  const itemId = parseInt(req.params.id);
  wishlistItems = wishlistItems.filter((item) => item.id !== itemId);
  res.redirect("/");
});

// POST: Move all items to cart
router.post("/move-all-to-cart", (req, res) => {
  // In a real app, you'd move all items to the cart and clear the wishlist
  wishlistItems = [];
  res.redirect("/");
});

// POST: Empty the wishlist
router.post("/empty", (req, res) => {
  wishlistItems = [];
  res.redirect("/");
});

module.exports = router;*/
// --------------------
const cartPage = async (req, res) => {
  try {
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
    res.render("cart", { cartItems, subtotal, discountedSubtotal });
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const resetPasswordPost = async (req, res) => {
  const { password, confirmPassword } = req.body;

  try {
    if (!req.session.resetUserId) {
      return res.redirect("/forgotPassword");
    }

    if (password !== confirmPassword) {
      return res.render("resetPassword", { error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.render("resetPassword", {
        error: "Password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.session.resetUserId);
    if (!user) {
      return res.render("resetPassword", { error: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    delete req.session.resetUserId;

    res.redirect("/login");
  } catch (error) {
    res.render("resetPassword", { error: "An error occurred" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.redirect("/");
      }
      res.clearCookie("connect.sid");
      res.redirect("/");
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
    req.session.userId = user._id;
    res.redirect("/");
  } catch (error) {
    res.render("userLogin", { error: "An error occurred" });
  }
};

module.exports = {
  pageNotFound,
  loadHomepage,
  loginPage,
  login,
  signUpPage,
  signUp,
  wishlistPage,
  cartPage,
  forgotPasswordPage,
  forgotPassword,
  resetPasswordGet,
  resetPasswordPost,
  logout,
  googleCallback,
};

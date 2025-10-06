const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

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

const logout = async (req, res) => {
  try {
    delete req.session.user;
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying user session during logout:", err);
      }
      res.clearCookie("user_session");
      return res.redirect("/login");
    });
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

module.exports = {
  pageNotFound,
  loadHomepage,
  loginPage,
  login,
  userDetails,
  logout,
  googleCallback,
};
const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");

const loginPage = async (req, res) => {
  try {
    if (req.session.admin && req.session.admin._id) {
      console.log("Admin already logged in, redirecting to dashboard");
      return res.redirect("/admin/dashboard");
    }
    
    const error = req.session.error || null;
    req.session.error = null; 
    return res.render("adminLogin", { error });
  } catch (error) {
    console.log("Admin login page error:", error);
    res.status(500).send("Server error");
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      req.session.error = "Email and password are required";
      return res.redirect("/admin");
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      req.session.error = "Email not found";
      return res.redirect("/admin");
    }
    
    if (user.role !== "admin") {
      req.session.error = "Access denied: Admins only";
      return res.redirect("/admin");
    }

    if (user.isBlocked) {
      req.session.error = "Account has been blocked";
      return res.redirect("/admin");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.session.error = "Invalid password";
      return res.redirect("/admin");
    }

    req.session.admin = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isLoggedIn: true
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        req.session.error = "Login failed, please try again";
        return res.redirect("/admin");
      }
      return res.redirect("/admin/dashboard");
    });
  } catch (error) {
    console.error("Admin login error:", error);
    req.session.error = "An error occurred";
    res.redirect("/admin");
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

const dashboardPage = async (req, res) => {
  try {
    return res.render("dashboard");
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const getAdminOrdersPage = async (req, res) => {
  try {
    const { page = 1, search = '', status = '', sort = 'desc' } = req.query;
    const limit = 10;
    const query = {};

    if (search) {
      const users = await User.find({ 
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id');
      query.userId = { $in: users.map(u => u._id) };
    }

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('userId')
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('orders', {
      orders,
      currentPage: parseInt(page),
      totalPages,
      search,
      status,
      sort
    });
  } catch (error) {
    console.error("Admin order page error:", error);
    res.status(500).send("Server Error");
  }
};

const statusUpdate = async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  try {
    await Order.findByIdAndUpdate(id, { status });
    res.json({ success: true });
  } catch (error) {
    console.error('Status update failed:', error);
    res.status(500).json({ success: false });
  }
};

const salesPage = async (req, res) => {
  try {
    const { page = 1, search = '', status = '', sort = 'desc' } = req.query;
    const limit = 10;
    const query = {};

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id fullName');
      query.userId = { $in: users.map(u => u._id) };
    }

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .sort({ orderDate: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sales = orders.map(order => ({
      id: order._id.toString(),
      date: order.orderDate.toISOString().split('T')[0],
      customer: order.userId?.fullName || 'Unknown',
      amount: `₹${order.totalAmount.toLocaleString('en-IN')}`,
      status: order.status
    }));

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("sales", {
      sales,
      currentPage: parseInt(page),
      totalPages,
      search,
      status,
      sort
    });
  } catch (error) {
    console.error("Error loading sales page:", error);
    res.status(500).send("Server error");
  }
};

const couponsPage = async (req, res) => {
  try {
    const { page = 1, search = '', status = '' } = req.query;
    const limit = 10;
    const query = {};

    if (search) {
      query.code = new RegExp(search, 'i');
    }

    if (status) {
      query.status = status;
    }

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("coupons", {
      coupons: coupons.map(coupon => ({
        id: coupon._id.toString(),
        code: coupon.code,
        discount: `${coupon.discount}%`,
        expiry: coupon.expiryDate.toISOString().split('T')[0],
        status: coupon.status
      })),
      currentPage: parseInt(page),
      totalPages,
      search,
      status,
      error: req.session.error || null,
      success: req.session.success || null
    });
    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Error loading coupons page:", error);
    res.status(500).send("Server error");
  }
};

const getCreateCouponPage = async (req, res) => {
  try {
    res.render("createCoupon", {
      admin: req.session.admin,
      error: req.session.error || null,
      success: req.session.success || null
    });
    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Error loading create coupon page:", error);
    res.status(500).send("Server error");
  }
};

const postCreateCoupon = async (req, res) => {
  try {
    const { code, discount, expiryDate, usageLimit } = req.body;

    if (!code || !discount || !expiryDate || !usageLimit) {
      return res.json({ success: false, message: "All fields are required" });
    }

    if (await Coupon.findOne({ code: code.toUpperCase() })) {
      return res.json({ success: false, message: "Coupon code already exists" });
    }

    if (isNaN(discount) || discount < 0 || discount > 100) {
      return res.json({ success: false, message: "Discount must be between 0 and 100" });
    }

    if (new Date(expiryDate) <= new Date()) {
      return res.json({ success: false, message: "Expiry date must be in the future" });
    }

    if (isNaN(usageLimit) || usageLimit < 1) {
      return res.json({ success: false, message: "Usage limit must be a positive integer" });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      expiryDate: new Date(expiryDate),
      usageLimit: parseInt(usageLimit),
      status: 'Active'
    });

    await coupon.save();
    req.session.success = "Coupon created successfully";
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.json({ success: false, message: "Failed to create coupon" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    if (coupon.usedBy.length > 0) {
      return res.json({ success: false, message: "Cannot delete coupon in use" });
    }

    await Coupon.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.json({ success: false, message: "Failed to delete coupon" });
  }
};

module.exports = {
  loginPage,
  login,
  dashboardPage,
  getAdminOrdersPage,
  statusUpdate,
  salesPage,
  couponsPage,
  getCreateCouponPage,
  postCreateCoupon,
  deleteCoupon,
  logout,
};
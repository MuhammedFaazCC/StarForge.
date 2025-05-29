const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const validator = require("validator");


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
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error in admin logout:", err);
        return res.status(500).send("Error during logout");
      }
      res.clearCookie("connect.sid");
      return res.redirect("/admin");
    });
  } catch (error) {
    console.error("Error during admin logout:", error);
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




const ordersPage = async (req, res) => {
  try {
    const orders = [
      {
        id: "ORD001",
        User: "John Doe",
        date: "2025-05-01",
        total: "₹2,500",
        status: "Delivered",
      },
      {
        id: "ORD002",
        User: "Jane Smith",
        date: "2025-05-02",
        total: "₹1,800",
        status: "Processing",
      },
      {
        id: "ORD003",
        User: "Sam Wilson",
        date: "2025-05-03",
        total: "₹3,200",
        status: "Shipped",
      },
    ];

    res.render("orders", { orders });
  } catch (error) {
    console.log("Error loading orders page:", error);
    res.status(500).send("Server error");
  }
};


const salesPage = async (req, res) => {
  try {
    const sales = [
      {
        id: "SALE001",
        date: "2025-05-01",
        customer: "John Doe",
        amount: "₹2,500",
        status: "Paid",
      },
      {
        id: "SALE002",
        date: "2025-05-02",
        customer: "Jane Smith",
        amount: "₹1,800",
        status: "Pending",
      },
      {
        id: "SALE003",
        date: "2025-05-03",
        customer: "Sam Wilson",
        amount: "₹3,200",
        status: "Paid",
      },
    ];

    res.render("sales", { sales });
  } catch (error) {
    console.error("Error loading sales page:", error);
    res.status(500).send("Server error");
  }
};

const couponsPage = async (req, res) => {
  try {
    const coupons = [
      {
        code: "SAVE10",
        discount: "10%",
        expiry: "2025-06-01",
        status: "Active",
      },
      {
        code: "FREESHIP",
        discount: "Free Shipping",
        expiry: "2025-06-15",
        status: "Expired",
      },
      {
        code: "WELCOME20",
        discount: "20%",
        expiry: "2025-07-01",
        status: "Active",
      },
    ];

    res.render("coupons", { coupons });
  } catch (error) {
    console.error("Error loading coupons page:", error);
    res.status(500).send("Server error");
  }
};

const bannersPage = async (req, res) => {
  try {
    const banners = [
      {
        imageUrl: "https://via.placeholder.com/50",
        title: "Summer Sale",
        startingDate: "01/06/2024",
        endingDate: "30/06/2024",
        status: "Active",
      },
      {
        imageUrl: "https://via.placeholder.com/50",
        title: "Winter Collection",
        startingDate: "01/12/2024",
        endingDate: "31/12/2024",
        status: "Scheduled",
      },
      {
        imageUrl: "https://via.placeholder.com/50",
        title: "Black Friday",
        startingDate: "25/11/2024",
        endingDate: "28/11/2024",
        status: "Expired",
      },
    ];

    res.render("banner", { banners });
  } catch (error) {
    console.error("Failed to load banners page:", error);
    res.status(500).send("Server error");
  }
};

module.exports = {
  loginPage,
  login,
  dashboardPage,
  ordersPage,
  salesPage,
  couponsPage,
  bannersPage,
  logout,
};
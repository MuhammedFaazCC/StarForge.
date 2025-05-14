const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const validator = require('validator');


const loginPage = async (req, res) => {
  try {
    return res.render("login");
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
    console.log(req.body);
    
  try {
    if (!email || !password) {
      return res.render("login", { error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render("login", { error: "Email not found" });
    }

    if (user.role !== 'admin') {
      return res.render("login", { error: "Access denied: Admins only" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login", { error: "Invalid password" });
    }

    req.session.user = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error('Login error:', error);
    res.render("userLogin", { error: "An error occurred. Please try again later." });
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

const productsPage = async (req, res) => {
  try {
    const products = [
      { id: 'PROD001', name: 'Wireless Mouse', category: 'Electronics', price: '₹1,299', stock: 50 },
      { id: 'PROD002', name: 'Mechanical Keyboard', category: 'Electronics', price: '₹4,499', stock: 30 },
      { id: 'PROD003', name: 'Office Chair', category: 'Furniture', price: '₹7,999', stock: 15 }
    ];
    
    return res.render("products", { products });
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const ordersPage = async (req, res) => {
  try {
    const orders = [
      { id: 'ORD001', customer: 'John Doe', date: '2025-05-01', total: '₹2,500', status: 'Delivered' },
      { id: 'ORD002', customer: 'Jane Smith', date: '2025-05-02', total: '₹1,800', status: 'Processing' },
      { id: 'ORD003', customer: 'Sam Wilson', date: '2025-05-03', total: '₹3,200', status: 'Shipped' }
    ];

    res.render("orders", { orders });
  } catch (error) {
    console.log("Error loading orders page:", error);
    res.status(500).send("Server error");
  }
};

const customersPage = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const sortField = req.query.sort || 'registered';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    try {
        const customers = await Customer.find()
            .sort({ [sortField]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit);
        
        const total = await Customer.countDocuments();
        const totalPages = Math.ceil(total / limit);

        res.render('customers', {
            customers,
            currentPage: page,
            totalPages,
            message: null
        });
    } catch (error) {
        res.render('customers', {
            customers: [],
            currentPage: 1,
            totalPages: 1,
            message: { type: 'error', text: 'Error fetching customers' }
        });
    }
};

const customerBlock = async (req, res) => {
    const { id, action } = req.params;
    try {
        await Customer.findByIdAndUpdate(id, {
            isBlocked: action === 'block'
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

const customerClear = async (req, res) => {
    try {
        await Customer.deleteMany({});
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

const addCustomer = (req, res) => {
    try {
    return res.render('addCustomer', { message: null });
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const customerAdd = async (req, res) => {
    const { fullName, email, mobile, password, orders, isBlocked } = req.body;

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
        if (existingUser) {
            return res.render('addCustomer', {
                message: { type: 'error', text: 'Email or mobile already exists' }
            });
        }

        const userData = {
            fullName,
            email,
            mobile,
            orders: parseInt(orders) || 0,
            isBlocked: isBlocked === 'on',
            role: 'customer'
        };

        if (password) {
            userData.password = password;
        }

        const newUser = new User(userData);
        await newUser.save();

        res.redirect('customers');
    } catch (error) {
        res.render('addCustomer', {
            message: { type: 'error', text: 'Error adding customer: ' + error.message }
        });
    }
};

const salesPage = async (req, res) => {
  try {
    const sales = [
      { id: 'SALE001', date: '2025-05-01', customer: 'John Doe', amount: '₹2,500', status: 'Paid' },
      { id: 'SALE002', date: '2025-05-02', customer: 'Jane Smith', amount: '₹1,800', status: 'Pending' },
      { id: 'SALE003', date: '2025-05-03', customer: 'Sam Wilson', amount: '₹3,200', status: 'Paid' }
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
      { code: 'SAVE10', discount: '10%', expiry: '2025-06-01', status: 'Active' },
      { code: 'FREESHIP', discount: 'Free Shipping', expiry: '2025-06-15', status: 'Expired' },
      { code: 'WELCOME20', discount: '20%', expiry: '2025-07-01', status: 'Active' }
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
        imageUrl: 'https://via.placeholder.com/50',
        title: 'Summer Sale',
        startingDate: '01/06/2024',
        endingDate: '30/06/2024',
        status: 'Active'
      },
      {
        imageUrl: 'https://via.placeholder.com/50',
        title: 'Winter Collection',
        startingDate: '01/12/2024',
        endingDate: '31/12/2024',
        status: 'Scheduled'
      },
      {
        imageUrl: 'https://via.placeholder.com/50',
        title: 'Black Friday',
        startingDate: '25/11/2024',
        endingDate: '28/11/2024',
        status: 'Expired'
      }
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
    productsPage,
    ordersPage,
    customersPage,
    customerBlock,
    customerClear,
    addCustomer,
    customerAdd,
    salesPage,
    couponsPage,
    bannersPage,
}
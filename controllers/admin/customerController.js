const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');

async function getOrderCountForCustomer(customerId) {
    try {
        const orderCount = await Order.countDocuments({ customerId });
        return orderCount;
    } catch (error) {
        console.error(`Error counting orders for customer ${customerId}:`, error);
        return 0;
    }
}

const customersPage = async function customersPage(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const searchQuery = { role: 'customer' };
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const customers = await User.find(searchQuery)
      .select('fullName email mobile isActive isBlocked createdAt')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    const totalCustomers = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCustomers / limit);

    const customersWithOrders = await Promise.all(customers.map(async (customer) => {
      const orderCount = await getOrderCountForCustomer(customer._id); // Ensure this function exists
      return {
        ...customer.toObject(),
        orders: orderCount
      };
    }));

    res.render('customers', {
      customers: customersWithOrders,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        prevPage: page - 1,
        nextPage: page + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages
      },
      query: '',
      message: req.flash('message')
    });
  } catch (err) {
    console.error("Error loading customers page:", err);
    req.flash('message', { type: 'error', text: 'Error loading customers' });
    res.redirect('/admin/customers');
  }
}

const customerClear = async (req, res) => {
  try {
    await User.deleteMany({ role: 'customer' });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

const addCustomer = (req, res) => {
  try {
    return res.render("addCustomer", { message: null });
  } catch {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const getAllCustomers = async (req, res) => {
    try {
        const customers = await User.find({ role: "customer" })
            .select("fullName email mobile isActive isBlocked referralPoints createdAt orders")
            .sort({ createdAt: -1 });

        // Add orders count for each customer
        const customersWithOrders = await Promise.all(customers.map(async (customer) => {
            const orderCount = await getOrderCountForCustomer(customer._id);
            return {
                ...customer.toObject(),
                orders: orderCount
            };
        }));

        res.status(200).json({
            success: true,
            customers: customersWithOrders
        });
    } catch (err) {
        console.error("Error getting customers:", err);
        res.status(500).json({
            success: false,
            error: "Failed to get customers",
            message: err.message
        });
    }
};

const searchCustomers = async (req, res) => {
  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 8; // Set to 8 customers per page
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let searchQuery = { role: 'customer' };
    if (query && query.trim() !== '') {
      searchQuery = {
        role: 'customer',
        $or: [
          { fullName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { mobile: { $regex: query, $options: 'i' } },
          { referralCode: { $regex: query, $options: 'i' } }
        ]
      };
    }

    const skip = (page - 1) * limit;
    const sort = { [sortField]: sortOrder };

    const customers = await User.find(searchQuery)
      .select('fullName email mobile isActive isBlocked createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalCustomers = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCustomers / limit);

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      const customersWithOrders = await Promise.all(customers.map(async (customer) => {
        const orderCount = await getOrderCountForCustomer(customer._id);
        return {
          ...customer.toObject(),
          orders: orderCount
        };
      }));

      return res.status(200).json({
        success: true,
        customers: customersWithOrders,
        pagination: {
          currentPage: page,
          totalPages,
          totalCustomers,
          limit
        }
      });
    }

    const customersWithOrders = await Promise.all(customers.map(async (customer) => {
      const orderCount = await getOrderCountForCustomer(customer._id);
      return {
        ...customer.toObject(),
        orders: orderCount
      };
    }));

    res.render('customers', {
      customers: customersWithOrders,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        prevPage: page - 1,
        nextPage: page + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages
      },
      query,
      message: req.flash('message')
    });
  } catch (err) {
    console.error("Error searching customers:", err);
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Failed to search customers',
        error: err.message
      });
    }
    req.flash('message', { type: 'error', text: 'Error searching customers' });
    res.redirect('/admin/customers');
  }
};

const getCustomerById = async (req, res) => {
  try {
    const userId = req.params.id;

    const customer = await User.findById(userId).select("-password");

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    res.status(200).json({ success: true, customer });
  } catch (err) {
    console.error("Error getting customer details:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to get customer details",
        message: err.message,
      });
  }
};

const customerToggleBlock = async (req, res) => {
  try {
    const userId = req.params.id;
    const action = req.params.action;

    console.log(`Processing ${action} for:user ${userId}`);

    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isBlocked = action === 'block';
    await User.findByIdAndUpdate(userId,{$set: { isBlocked }}, { new: true });

    console.log(`User ${userId} ${action}ed successfully`);

    res.status(200).json({ 
      success: true, 
      message: `User ${action}ed successfully` 
    });
  } catch (err) {
    console.error(`Error ${action}ing user:`, err);
    res.status(500).json({ 
      success: false, 
      message: `Failed to ${action} user`, 
      error: err.message 
    });
  }
};

const customerAdd = async (req, res) => {
  const { fullName, email, mobile, password, orders, isBlocked } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return res.render("addCustomer", {
        message: { type: "error", text: "Email or mobile already exists" },
      });
    }

    const userData = {
      fullName,
      email,
      mobile,
      orders: parseInt(orders) || 0,
      isBlocked: isBlocked === "on",
      role: "customer",
    };

    if (password) {
      userData.password = await bcrypt.hash(password, 10);
    }

    const newUser = new User(userData);
    await newUser.save();

    res.redirect("/admin/customers");
  } catch (error) {
    res.render("addCustomer", {
      message: {
        type: "error",
        text: "Error adding customer: " + error.message,
      },
    });
  }
};

module.exports = {
    customersPage,
    customerToggleBlock,
    customerClear,
    addCustomer,
    customerAdd,
    searchCustomers,
    getAllCustomers,
    getCustomerById,
}
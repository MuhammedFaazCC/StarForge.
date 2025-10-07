const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const ejs = require('ejs');
const path = require('path');

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
    delete req.session.admin;
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying admin session during logout:", err);
      }
      res.clearCookie("admin_session");
      return res.redirect("/admin");
    });
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
    const skip = (parseInt(page) - 1) * limit;

    const baseQuery = {};
    const orConditions = [];
    const trimmed = (search || '').trim();

    if (trimmed) {
      // Search by user name or email
      const users = await User.find({
        $or: [
          { fullName: new RegExp(trimmed, 'i') },
          { email: new RegExp(trimmed, 'i') }
        ]
      }).select('_id');
      if (users.length > 0) {
        orConditions.push({ userId: { $in: users.map(u => u._id) } });
      }

      // Search by exact Order ID (24-hex)
      if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
        try {
          const { Types } = require('mongoose');
          orConditions.push({ _id: new Types.ObjectId(trimmed) });
        } catch {}
      }

      // Search by status or payment method text
      orConditions.push({ status: new RegExp(trimmed, 'i') });
      orConditions.push({ paymentMethod: new RegExp(trimmed, 'i') });
    }

    if (status) {
      baseQuery.status = status;
    }

    const finalQuery = orConditions.length > 0 ? { $and: [baseQuery, { $or: orConditions }] } : baseQuery;

    const totalOrders = await Order.countDocuments(finalQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(finalQuery)
      .populate('userId')
      .populate({
        path: 'items.productId',
        select: 'name brand mainImage price salePrice offer',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    const pendingReturnsCount = await Order.countDocuments({
      $or: [
        { status: 'Return Requested' },
        { 'items.status': 'Return Requested' }
      ]
    });

    res.render('orders', {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalOrders: totalOrders,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      search: trimmed,
      status,
      sort,
      pendingReturnsCount
    });
  } catch (error) {
    console.error("Admin order page error:", error);
    res.status(500).send("Server Error");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate('userId')
      .populate('items.productId');

    if (!order) return res.status(404).send('Order not found');

    res.render('adminOrderDetails', { order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('Server error');
  }
};

const getInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate({
        path: 'items.productId',
        select: 'name brand mainImage price salePrice offer',
        options: { strictPopulate: false }
      });
    if (!order) return res.status(404).send("Order not found");

    const filePath = path.join(__dirname, '../../views/admin/invoicePdf.ejs');

    ejs.renderFile(filePath, {
      order,
      couponCode: order?.coupon?.code || 'N/A',
      discountAmount: order?.coupon?.discountAmount || 0
    }, (err, html) => {
      if (err) {
        console.error("EJS render error:", err);
        return res.status(500).send("Could not render invoice template");
      }

      const options = {
        format: 'A4',
        orientation: 'portrait',
        border: '10mm'
      };

      pdf.create(html, options).toBuffer((err, buffer) => {
        if (err) {
          console.error("PDF generation error:", err);
          return res.status(500).send("Could not generate PDF");
        }

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=invoice_${order._id}.pdf`,
          'Content-Length': buffer.length
        });

        return res.send(buffer);
      });
    });

  } catch (err) {
    console.error("Error generating invoice:", err);
    res.status(500).send("Internal Server Error");
  }
};

// const statusUpdate = async (req, res) => {
//   const { status } = req.body;
//   const { id } = req.params;

//   try {
//     await Order.findByIdAndUpdate(id, { status });
//     res.json({ success: true });
//   } catch (error) {
//     console.error('Status update failed:', error);
//     res.status(500).json({ success: false });
//   }
// };

const updateItemStatus = async (req, res) => {
  const { status } = req.body;
  const { orderId, itemId } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    item.status = status;
    
    if (status === 'Delivered') {
      item.deliveredAt = new Date();
    }

    await order.save();
    res.json({ success: true, message: 'Item status updated successfully' });
  } catch (error) {
    console.error('Item status update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update item status' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    const { status } = req.body;

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const finalStatuses = ['Delivered', 'Returned', 'Cancelled'];
    if (finalStatuses.includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot change status. Order is already ${order.status}` 
      });
    }

    const validStatuses = ['Pending Payment', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Placed', 'Return Requested', 'Returned', 'Return Declined', 'Payment Failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const oldStatus = order.status;
    order.status = status;

    order.items.forEach(item => {
      const itemFinalStatuses = ['Delivered', 'Returned', 'Cancelled'];
      if (!itemFinalStatuses.includes(item.status)) {
        let itemStatus = status;
        
        if (status === 'Pending Payment' || status === 'Pending') {
          itemStatus = 'Placed';
        } else if (status === 'Processing') {
          itemStatus = 'Processing';
        } else if (status === 'Shipped') {
          itemStatus = 'Shipped';
        } else if (status === 'Delivered') {
          itemStatus = 'Delivered';
        } else if (status === 'Cancelled') {
          itemStatus = 'Cancelled';
        }
        
        item.status = itemStatus;
        
        if (itemStatus === 'Delivered') {
          item.deliveredAt = new Date();
        } else if (itemStatus === 'Cancelled') {
          item.cancelledAt = new Date();
        }
      }
    });

    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      try {
        const { refundToWallet } = require('../user/userController');
        await refundToWallet(order, "Order cancelled by admin");
      } catch (refundError) {
        console.error("Error processing refund:", refundError);
      }
    }

    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      try {
        const Product = require("../../models/productSchema");
        for (const item of order.items) {
          if (item.productId) {
            await Product.updateOne(
              { _id: item.productId },
              { $inc: { stock: item.quantity } }
            );
            console.log(`Stock restored for cancelled item ${item.productId}: +${item.quantity}`);
          }
        }
      } catch (stockError) {
        console.error("Error restoring stock for cancelled order:", stockError);
      }
    }

    res.json({ 
      success: true, 
      message: `Order status updated to ${status} successfully`,
      newStatus: status
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  loginPage,
  login,
  logout,
  dashboardPage,
  getAdminOrdersPage,
  getOrderDetails,
  getInvoicePDF,
  updateItemStatus,
  updateOrderStatus,
};
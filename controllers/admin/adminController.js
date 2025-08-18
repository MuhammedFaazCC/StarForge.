const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const Return = require("../../models/returnSchema");
const Config = require("../../models/configSchema");
const ejs = require('ejs');
const path = require('path');
const pdf = require('html-pdf');
const ExcelJS = require('exceljs');
const json2csv = require('json2csv').parse;

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
    const skip = (parseInt(page) - 1) * limit;
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

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
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
      search,
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

    const filePath = path.join(__dirname, '../../views/admin/invoicePdf.ejs'); // eslint-disable-line no-undef

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

    // Update the item status
    item.status = status;
    
    // If marking as delivered, set delivered timestamp
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

const salesPage = async (req, res) => {
  try {
    const { 
      page = 1, 
      search = '', 
      status = '', 
      sort = 'date_desc',
      dateFilter = '',
      startDate = '',
      endDate = '',
      paymentMethod = ''
    } = req.query;
    
    const limit = 10;
    const query = {};

    // Build date query
    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateQuery = { orderDate: { $gte: startOfDay, $lt: endOfDay } };
        break;
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        dateQuery = { orderDate: { $gte: startOfWeek, $lt: endOfWeek } };
        break;
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateQuery = { orderDate: { $gte: startOfMonth, $lt: endOfMonth } };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery = { orderDate: { $gte: start, $lte: end } };
        }
        break;
    }

    Object.assign(query, dateQuery);

    // Search by customer name
    if (search) {
      const users = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id fullName');
      query.userId = { $in: users.map(u => u._id) };
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== '') {
      query.paymentMethod = paymentMethod;
    }

    // Get all orders for analytics (before pagination)
    const allMatchingOrders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name');

    // Calculate comprehensive analytics
    // Include all successful orders (exclude cancelled, payment failed)
    const successfulOrders = allMatchingOrders.filter(order => 
      !['Cancelled', 'Payment Failed'].includes(order.status)
    );
    const returnedOrders = allMatchingOrders.filter(order => order.status === 'Returned');
    
    const totalProductsSold = successfulOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const totalDiscounts = successfulOrders.reduce((sum, order) => sum + (order.coupon?.discountAmount || 0), 0);
    const totalSales = successfulOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalReturns = returnedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const netRevenue = totalSales - totalReturns;

    const analytics = {
      totalSales: totalSales,
      totalOrders: successfulOrders.length,
      totalProductsSold: totalProductsSold,
      totalDiscounts: totalDiscounts,
      totalReturns: totalReturns,
      netRevenue: netRevenue,
      returnedOrdersCount: returnedOrders.length,
      averageOrderValue: successfulOrders.length > 0 ? Math.round(totalSales / successfulOrders.length) : 0
    };

    // Apply sorting
    let sortCriteria = {};
    switch (sort) {
      case 'date_asc':
        sortCriteria = { orderDate: 1 };
        break;
      case 'date_desc':
        sortCriteria = { orderDate: -1 };
        break;
      case 'amount_asc':
        sortCriteria = { totalAmount: 1 };
        break;
      case 'amount_desc':
        sortCriteria = { totalAmount: -1 };
        break;
      default:
        sortCriteria = { orderDate: -1 };
    }

    // Get paginated orders
    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name')
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit);

    // Format sales data for display
    const sales = orders.map(order => ({
      id: order._id.toString(),
      orderDate: order.orderDate.toISOString().split('T')[0],
      customerName: order.userId?.fullName || 'Unknown',
      paymentMethod: order.paymentMethod,
      couponUsed: order.coupon?.code || 'N/A',
      totalAmount: order.totalAmount + (order.coupon?.discountAmount || 0), // Original amount before discount
      discount: order.coupon?.discountAmount || 0,
      netPaidAmount: order.totalAmount, // Amount actually paid
      orderStatus: order.status,
      productsList: order.items.map(item => ({
        name: item.productId?.name || item.name,
        quantity: item.quantity,
        price: item.salesPrice
      }))
    }));

    const totalPages = Math.ceil(allMatchingOrders.length / limit);

    res.render("sales", {
      sales,
      analytics,
      currentPage: parseInt(page),
      totalPages,
      search,
      status,
      sort,
      dateFilter,
      startDate,
      endDate,
      paymentMethod
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
        status: coupon.status,
        minimumAmount: coupon.minimumAmount || 0
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



const postCreateCoupon = async (req, res) => {
  try {
    const { code, discount, expiryDate, usageLimit, minimumAmount } = req.body;

    if (!code || !discount || !expiryDate || !usageLimit) {
      return res.json({ success: false, message: "All required fields must be filled" });
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

    const minAmount = minimumAmount ? parseFloat(minimumAmount) : 0;
    if (minAmount < 0) {
      return res.json({ success: false, message: "Minimum amount cannot be negative" });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      expiryDate: new Date(expiryDate),
      usageLimit: parseInt(usageLimit),
      minimumAmount: minAmount,
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

const getCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    
    if (!coupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    res.json({ success: true, coupon });
  } catch (error) {
    console.error("Error fetching coupon:", error);
    res.json({ success: false, message: "Failed to fetch coupon" });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discount, expiryDate, usageLimit, minimumAmount } = req.body;

    if (!code || !discount || !expiryDate || !usageLimit) {
      return res.json({ success: false, message: "All required fields must be filled" });
    }

    // Check if coupon exists
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    // Check if code already exists (excluding current coupon)
    const duplicateCoupon = await Coupon.findOne({ 
      code: code.toUpperCase(), 
      _id: { $ne: id } 
    });
    if (duplicateCoupon) {
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

    const minAmount = minimumAmount ? parseFloat(minimumAmount) : 0;
    if (minAmount < 0) {
      return res.json({ success: false, message: "Minimum amount cannot be negative" });
    }

    // Update coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(id, {
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      expiryDate: new Date(expiryDate),
      usageLimit: parseInt(usageLimit),
      minimumAmount: minAmount
    }, { new: true });

    res.json({ 
      success: true, 
      message: "Coupon updated successfully",
      coupon: updatedCoupon
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.json({ success: false, message: "Failed to update coupon" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Check if force delete is requested
    
    // Validate the coupon ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid coupon ID" });
    }

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    // Check if coupon is currently being used in any active orders
    const Order = require("../../models/orderSchema");
    const ordersUsingCoupon = await Order.countDocuments({ 
      'coupon.code': coupon.code,
      status: { $nin: ['Cancelled', 'Payment Failed'] }
    });

    if (ordersUsingCoupon > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete coupon "${coupon.code}". It is currently being used in ${ordersUsingCoupon} active order(s).`,
        canSoftDelete: false
      });
    }

    // Check if coupon has been used by users (has usage history)
    const totalUsageCount = coupon.usedBy.reduce((total, usage) => total + usage.usedCount, 0);
    const hasUsageHistory = totalUsageCount > 0;

    if (hasUsageHistory && force !== 'true') {
      // Offer soft delete option for coupons with usage history
      return res.status(400).json({ 
        success: false, 
        message: `Coupon "${coupon.code}" has been used ${totalUsageCount} time(s). You can either permanently delete it (losing usage history) or deactivate it to preserve the data.`,
        canSoftDelete: true,
        usageCount: totalUsageCount
      });
    }

    if (force === 'true') {
      // Force delete - permanently remove the coupon
      await Coupon.findByIdAndDelete(id);
      console.log(`Coupon force deleted: ${coupon.code} (ID: ${id})`);
      res.status(200).json({ 
        success: true, 
        message: `Coupon "${coupon.code}" permanently deleted` 
      });
    } else {
      // Regular delete for unused coupons
      await Coupon.findByIdAndDelete(id);
      console.log(`Coupon deleted successfully: ${coupon.code} (ID: ${id})`);
      res.status(200).json({ 
        success: true, 
        message: `Coupon "${coupon.code}" deleted successfully` 
      });
    }
    
  } catch (error) {
    console.error("Error deleting coupon:", error);
    
    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: "Invalid coupon ID format" });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete coupon. Please try again." 
    });
  }
};

const softDeleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the coupon ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid coupon ID" });
    }

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    if (coupon.status === 'Inactive') {
      return res.status(400).json({ 
        success: false, 
        message: `Coupon "${coupon.code}" is already deactivated` 
      });
    }

    // Soft delete by setting status to Inactive
    coupon.status = 'Inactive';
    coupon.deactivatedAt = new Date();
    await coupon.save();
    
    console.log(`Coupon soft deleted (deactivated): ${coupon.code} (ID: ${id})`);
    res.status(200).json({ 
      success: true, 
      message: `Coupon "${coupon.code}" has been deactivated. Usage history preserved.` 
    });
    
  } catch (error) {
    console.error("Error soft deleting coupon:", error);
    
    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: "Invalid coupon ID format" });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to deactivate coupon. Please try again." 
    });
  }
};

const reactivateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the coupon ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid coupon ID" });
    }

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    if (coupon.status === 'Active') {
      return res.status(400).json({ 
        success: false, 
        message: `Coupon "${coupon.code}" is already active` 
      });
    }

    if (coupon.status === 'Expired') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reactivate expired coupon "${coupon.code}". Please create a new coupon or extend the expiry date.` 
      });
    }

    // Check if coupon has expired
    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reactivate coupon "${coupon.code}" as it has expired. Please create a new coupon or extend the expiry date.` 
      });
    }

    // Reactivate by setting status to Active
    coupon.status = 'Active';
    coupon.reactivatedAt = new Date();
    // Remove deactivatedAt field if it exists
    if (coupon.deactivatedAt) {
      coupon.deactivatedAt = undefined;
    }
    await coupon.save();
    
    console.log(`Coupon reactivated: ${coupon.code} (ID: ${id})`);
    res.status(200).json({ 
      success: true, 
      message: `Coupon "${coupon.code}" has been reactivated successfully.` 
    });
    
  } catch (error) {
    console.error("Error reactivating coupon:", error);
    
    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: "Invalid coupon ID format" });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to reactivate coupon. Please try again." 
    });
  }
};

const getReturnRequestsPage = async (req, res) => {
  try {
    const { page = 1, search = '', sort = 'desc' } = req.query;
    const limit = 10;
    
    const orderQuery = { 
      $or: [
        { status: 'Return Requested' },
        { 'items.status': 'Return Requested' }
      ]
    };

    if (search) {
      const users = await User.find({ 
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id');
      orderQuery.userId = { $in: users.map(u => u._id) };
    }

    const orders = await Order.find(orderQuery)
      .populate('userId')
      .populate('items.productId')
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const ordersWithReturns = await Promise.all(
      orders.map(async (order) => {
        const returnRequest = await Return.findOne({ orderId: order._id });
        
        const itemReturns = order.items.filter(item => item.status === 'Return Requested');
        
        return {
          ...order.toObject(),
          returnReason: returnRequest?.reason || 'No reason provided',
          returnRequestedAt: returnRequest?.requestedAt || order.updatedAt,
          hasFullOrderReturn: order.status === 'Return Requested',
          hasItemReturns: itemReturns.length > 0,
          itemReturns: itemReturns
        };
      })
    );

    const totalOrders = await Order.countDocuments(orderQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('adminReturns', {
      orders: ordersWithReturns,
      currentPage: parseInt(page),
      totalPages,
      search,
      sort
    });
  } catch (error) {
    console.error("Error loading return requests:", error);
    res.status(500).send("Server Error");
  }
};

const acceptReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId).populate({
      path: 'items.productId',
      select: 'name brand mainImage price salePrice offer',
      options: { strictPopulate: false }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Order is not in return requested status" });
    }

    order.status = "Returned";
    await order.save();

    await Return.findOneAndUpdate(
      { orderId },
      { status: "Approved", updatedAt: new Date() }
    );

    try {
      const Product = require("../../models/productSchema");
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.productId._id || item.productId },
          { $inc: { stock: item.quantity } }
        );
        console.log(`Stock restored for product ${item.productId._id || item.productId}: +${item.quantity}`);
      }
    } catch (stockError) {
      console.error("Error restoring stock for returned order:", stockError);
    }

    if (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') {
      try {
        const { updateWallet } = require("../user/walletController");
        await updateWallet(
          order.userId,
          order.totalAmount,
          `Refund for returned order #${order._id}`,
          "Credit"
        );
      } catch (refundError) {
        console.error("Refund error:", refundError);
      }
    }

    res.json({ 
      success: true, 
      message: "Return request accepted successfully" + 
        (order.paymentMethod !== 'COD' ? ". Refund has been processed to customer's wallet." : "") +
        ". Product stock has been restored."
    });

  } catch (error) {
    console.error("Error accepting return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const declineReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Order is not in return requested status" });
    }

    order.status = "Return Declined";
    await order.save();

    await Return.findOneAndUpdate(
      { orderId },
      { status: "Rejected", updatedAt: new Date() }
    );

    res.json({ 
      success: true, 
      message: "Return request declined successfully" 
    });

  } catch (error) {
    console.error("Error declining return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const acceptItemReturnRequest = async (req, res) => {
  try {
    const { orderId, productId } = req.params;

    const order = await Order.findById(orderId).populate({
      path: 'items.productId',
      select: 'name brand mainImage price salePrice offer',
      options: { strictPopulate: false }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(i => i.productId && i.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }

    if (item.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Item is not in return requested status" });
    }

    item.status = "Returned";
    item.returnApprovedAt = new Date();
    await order.save();

    try {
      const Product = require("../../models/productSchema");
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: item.quantity } }
      );
      console.log(`Stock restored for returned item ${item.productId._id}: +${item.quantity}`);
    } catch (stockError) {
      console.error("Error restoring stock for returned item:", stockError);
    }

    if (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') {
      try {
        const { updateWallet } = require("../user/walletController");
        const refundAmount = item.salesPrice * item.quantity;
        await updateWallet(
          order.userId,
          refundAmount,
          `Refund for returned item ${item.productId.name} from order #${order._id}`,
          "Credit"
        );
      } catch (refundError) {
        console.error("Refund error for item return:", refundError);
      }
    }

    res.json({ 
      success: true, 
      message: "Item return request accepted successfully" + 
        (order.paymentMethod !== 'COD' ? ". Refund has been processed to customer's wallet." : "") +
        ". Product stock has been restored."
    });

  } catch (error) {
    console.error("Error accepting item return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const declineItemReturnRequest = async (req, res) => {
  try {
    const { orderId, productId } = req.params;

    const order = await Order.findById(orderId).populate({
      path: 'items.productId',
      select: 'name brand mainImage price salePrice offer',
      options: { strictPopulate: false }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(i => i.productId && i.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }

    if (item.status !== "Return Requested") {
      return res.status(400).json({ success: false, message: "Item is not in return requested status" });
    }

    item.status = "Return Declined";
    item.returnDeclinedAt = new Date();
    await order.save();

    res.json({ 
      success: true, 
      message: "Item return request declined successfully" 
    });

  } catch (error) {
    console.error("Error declining item return request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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

    // Check if order status is final
    const finalStatuses = ['Delivered', 'Returned', 'Cancelled'];
    if (finalStatuses.includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot change status. Order is already ${order.status}` 
      });
    }

    // Validate status transition
    const validStatuses = ['Pending Payment', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Placed', 'Return Requested', 'Returned', 'Return Declined', 'Payment Failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const oldStatus = order.status;
    order.status = status;

    // Update all items to match order status, but only if they're not in a final state
    order.items.forEach(item => {
      const itemFinalStatuses = ['Delivered', 'Returned', 'Cancelled'];
      if (!itemFinalStatuses.includes(item.status)) {
        // Map order status to appropriate item status
        let itemStatus = status;
        
        // Handle special mappings
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
        
        // Set timestamps for specific statuses
        if (itemStatus === 'Delivered') {
          item.deliveredAt = new Date();
        } else if (itemStatus === 'Cancelled') {
          item.cancelledAt = new Date();
        }
      }
    });

    // Set order-level timestamps
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Handle wallet refunds for cancellations
    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      try {
        const { refundToWallet } = require('../user/userController');
        await refundToWallet(order, "Order cancelled by admin");
      } catch (refundError) {
        console.error("Error processing refund:", refundError);
        // Continue with status update even if refund fails
      }
    }

    // Handle stock restoration for cancellations
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

const exportSalesReportPDF = async (req, res) => {
  try {
    const { 
      search = '', 
      status = '', 
      dateFilter = '',
      startDate = '',
      endDate = '',
      paymentMethod = ''
    } = req.query;
    
    const query = {};

    // Build date query
    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateQuery = { orderDate: { $gte: startOfDay, $lt: endOfDay } };
        break;
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        dateQuery = { orderDate: { $gte: startOfWeek, $lt: endOfWeek } };
        break;
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateQuery = { orderDate: { $gte: startOfMonth, $lt: endOfMonth } };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery = { orderDate: { $gte: start, $lte: end } };
        }
        break;
    }

    Object.assign(query, dateQuery);

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id fullName');
      query.userId = { $in: users.map(u => u._id) };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (paymentMethod && paymentMethod !== '') {
      query.paymentMethod = paymentMethod;
    }

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name')
      .sort({ orderDate: -1 });

    // Calculate comprehensive analytics
    const successfulOrders = orders.filter(order => 
      !['Cancelled', 'Payment Failed'].includes(order.status)
    );
    const returnedOrders = orders.filter(order => order.status === 'Returned');
    
    const totalProductsSold = successfulOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const totalDiscounts = successfulOrders.reduce((sum, order) => sum + (order.coupon?.discountAmount || 0), 0);
    const totalSales = successfulOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalReturns = returnedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const netRevenue = totalSales - totalReturns;

    const analytics = {
      totalSales: totalSales,
      totalOrders: successfulOrders.length,
      totalProductsSold: totalProductsSold,
      totalDiscounts: totalDiscounts,
      totalReturns: totalReturns,
      netRevenue: netRevenue
    };

    const sales = orders.map(order => ({
      id: order._id.toString(),
      date: order.orderDate.toISOString().split('T')[0],
      customer: order.userId?.fullName || 'Unknown',
      paymentMethod: order.paymentMethod,
      subtotal: order.totalAmount + (order.coupon?.discountAmount || 0),
      discount: order.coupon?.discountAmount || 0,
      couponCode: order.coupon?.code || 'N/A',
      totalAmount: order.totalAmount,
      status: order.status
    }));

    const filePath = path.join(__dirname, '../../views/admin/salesReportPdf.ejs'); // eslint-disable-line no-undef

    ejs.renderFile(filePath, {
      sales,
      analytics,
      dateFilter,
      startDate,
      endDate,
      generatedAt: new Date().toLocaleString()
    }, (err, html) => {
      if (err) {
        console.error("EJS render error:", err);
        return res.status(500).send("Could not render sales report template");
      }

      const options = {
        format: 'A4',
        orientation: 'landscape',
        border: '10mm'
      };

      pdf.create(html, options).toBuffer((err, buffer) => {
        if (err) {
          console.error("PDF generation error:", err);
          return res.status(500).send("Could not generate PDF");
        }

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=sales_report_${new Date().toISOString().split('T')[0]}.pdf`,
          'Content-Length': buffer.length
        });

        return res.send(buffer);
      });
    });

  } catch (error) {
    console.error("Error generating sales report PDF:", error);
    res.status(500).send("Internal Server Error");
  }
};

const exportSalesReportExcel = async (req, res) => {
  try {
    const { 
      search = '', 
      status = '', 
      dateFilter = '',
      startDate = '',
      endDate = '',
      paymentMethod = ''
    } = req.query;
    
    const query = {};

    // Build date query
    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateQuery = { orderDate: { $gte: startOfDay, $lt: endOfDay } };
        break;
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        dateQuery = { orderDate: { $gte: startOfWeek, $lt: endOfWeek } };
        break;
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateQuery = { orderDate: { $gte: startOfMonth, $lt: endOfMonth } };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery = { orderDate: { $gte: start, $lte: end } };
        }
        break;
    }

    Object.assign(query, dateQuery);

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id fullName');
      query.userId = { $in: users.map(u => u._id) };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (paymentMethod && paymentMethod !== '') {
      query.paymentMethod = paymentMethod;
    }

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name')
      .sort({ orderDate: -1 });

    // Calculate comprehensive analytics
    const successfulOrders = orders.filter(order => 
      !['Cancelled', 'Payment Failed'].includes(order.status)
    );
    const returnedOrders = orders.filter(order => order.status === 'Returned');
    
    const totalProductsSold = successfulOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const totalDiscounts = successfulOrders.reduce((sum, order) => sum + (order.coupon?.discountAmount || 0), 0);
    const totalSales = successfulOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalReturns = returnedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const netRevenue = totalSales - totalReturns;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 25 },
      { header: 'Order Date', key: 'date', width: 12 },
      { header: 'Customer Name', key: 'customer', width: 20 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Coupon Used', key: 'couponCode', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Net Paid Amount', key: 'netPaidAmount', width: 15 },
      { header: 'Order Status', key: 'status', width: 15 },
      { header: 'Products List', key: 'productsList', width: 50 }
    ];

    orders.forEach(order => {
      worksheet.addRow({
        id: order._id.toString(),
        date: order.orderDate.toISOString().split('T')[0],
        customer: order.userId?.fullName || 'Unknown',
        paymentMethod: order.paymentMethod,
        couponCode: order.coupon?.code || 'N/A',
        totalAmount: order.totalAmount + (order.coupon?.discountAmount || 0),
        discount: order.coupon?.discountAmount || 0,
        netPaidAmount: order.totalAmount,
        status: order.status,
        productsList: order.items.map(item => 
          `${item.productId?.name || item.name} (Qty: ${item.quantity}, Price: ₹${item.salesPrice})`
        ).join('; ')
      });
    });

    // Add summary section
    worksheet.addRow({});
    worksheet.addRow({ id: 'SALES SUMMARY', customer: '', paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });
    worksheet.addRow({ id: 'Total Sales:', customer: `₹${totalSales.toLocaleString('en-IN')}`, paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });
    worksheet.addRow({ id: 'Total Orders:', customer: successfulOrders.length, paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });
    worksheet.addRow({ id: 'Total Products Sold:', customer: totalProductsSold, paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });
    worksheet.addRow({ id: 'Total Discounts:', customer: `₹${totalDiscounts.toLocaleString('en-IN')}`, paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });
    worksheet.addRow({ id: 'Total Returns:', customer: `₹${totalReturns.toLocaleString('en-IN')}`, paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });
    worksheet.addRow({ id: 'Net Revenue:', customer: `₹${netRevenue.toLocaleString('en-IN')}`, paymentMethod: '', couponCode: '', totalAmount: '', discount: '', netPaidAmount: '', status: '', productsList: '' });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error generating sales report Excel:", error);
    res.status(500).send("Internal Server Error");
  }
};

const exportSalesReportCSV = async (req, res) => {
  try {
    const { 
      search = '', 
      status = '', 
      dateFilter = '',
      startDate = '',
      endDate = '',
      paymentMethod = ''
    } = req.query;
    
    const query = {};

    // Build date query
    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateQuery = { orderDate: { $gte: startOfDay, $lt: endOfDay } };
        break;
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        dateQuery = { orderDate: { $gte: startOfWeek, $lt: endOfWeek } };
        break;
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateQuery = { orderDate: { $gte: startOfMonth, $lt: endOfMonth } };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateQuery = { orderDate: { $gte: start, $lte: end } };
        }
        break;
    }

    Object.assign(query, dateQuery);

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id fullName');
      query.userId = { $in: users.map(u => u._id) };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (paymentMethod && paymentMethod !== '') {
      query.paymentMethod = paymentMethod;
    }

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name')
      .sort({ orderDate: -1 });

    // Calculate analytics
    const successfulOrders = orders.filter(order => 
      !['Cancelled', 'Payment Failed'].includes(order.status)
    );
    const returnedOrders = orders.filter(order => order.status === 'Returned');
    
    const totalProductsSold = successfulOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const totalDiscounts = successfulOrders.reduce((sum, order) => sum + (order.coupon?.discountAmount || 0), 0);
    const totalSales = successfulOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalReturns = returnedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const netRevenue = totalSales - totalReturns;

    // Prepare CSV data
    const csvData = orders.map(order => ({
      'Order ID': order._id.toString(),
      'Order Date': order.orderDate.toISOString().split('T')[0],
      'Customer Name': order.userId?.fullName || 'Unknown',
      'Payment Method': order.paymentMethod,
      'Coupon Used': order.coupon?.code || 'N/A',
      'Total Amount': order.totalAmount + (order.coupon?.discountAmount || 0),
      'Discount': order.coupon?.discountAmount || 0,
      'Net Paid Amount': order.totalAmount,
      'Order Status': order.status,
      'Products List': order.items.map(item => 
        `${item.productId?.name || item.name} (Qty: ${item.quantity}, Price: ₹${item.salesPrice})`
      ).join('; ')
    }));

    // Add summary rows
    csvData.push({});
    csvData.push({ 'Order ID': 'SALES SUMMARY' });
    csvData.push({ 'Order ID': 'Total Sales', 'Customer Name': `₹${totalSales.toLocaleString('en-IN')}` });
    csvData.push({ 'Order ID': 'Total Orders', 'Customer Name': successfulOrders.length });
    csvData.push({ 'Order ID': 'Total Products Sold', 'Customer Name': totalProductsSold });
    csvData.push({ 'Order ID': 'Total Discounts', 'Customer Name': `₹${totalDiscounts.toLocaleString('en-IN')}` });
    csvData.push({ 'Order ID': 'Total Returns', 'Customer Name': `₹${totalReturns.toLocaleString('en-IN')}` });
    csvData.push({ 'Order ID': 'Net Revenue', 'Customer Name': `₹${netRevenue.toLocaleString('en-IN')}` });

    const csv = json2csv(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${new Date().toISOString().split('T')[0]}.csv`);
    
    res.send(csv);

  } catch (error) {
    console.error("Error generating sales report CSV:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getSalesChartData = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate, groupBy, dateFormat;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        dateFormat = 'daily';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        dateFormat = 'daily';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
        dateFormat = 'monthly';
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        dateFormat = 'daily';
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          status: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          totalDiscounts: { $sum: "$coupon.discountAmount" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      success: true,
      data: salesData,
      period,
      dateFormat
    });

  } catch (error) {
    console.error("Error getting sales chart data:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getReferralSettings = async (req, res) => {
  try {
    const referrerBonusConfig = await Config.findOne({ key: 'referrer_bonus_amount' });
    const newUserBonusConfig = await Config.findOne({ key: 'new_user_bonus_amount' });
    
    const referrerBonus = referrerBonusConfig ? referrerBonusConfig.value : 100;
    const newUserBonus = newUserBonusConfig ? newUserBonusConfig.value : 50;

    // Get referral statistics
    const totalReferrals = await User.countDocuments({ referredBy: { $exists: true, $ne: null } });
    const totalReferrers = await User.countDocuments({ referralCode: { $exists: true, $ne: null } });
    
    // Calculate total bonuses paid
    const users = await User.find({});
    let totalBonusPaid = 0;
    
    users.forEach(user => {
      if (user.wallet && user.wallet.transactions) {
        const referralTransactions = user.wallet.transactions.filter(
          transaction => transaction.type === 'credit' && 
          (transaction.description.includes('Referral Bonus') || transaction.description.includes('Signup Bonus'))
        );
        totalBonusPaid += referralTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      }
    });

    const success = req.session.success || null;
    const error = req.session.error || null;
    req.session.success = null;
    req.session.error = null;

    res.render('admin/referralSettings', {
      admin: req.session.admin,
      referrerBonus,
      newUserBonus,
      totalReferrals,
      totalReferrers,
      totalBonusPaid,
      success,
      error,
      currentPage: 'referral'
    });
  } catch (error) {
    console.error('Error loading referral settings:', error);
    req.session.error = 'Failed to load referral settings';
    res.redirect('/admin/dashboard');
  }
};

const updateReferralSettings = async (req, res) => {
  try {
    const { referrerBonus, newUserBonus } = req.body;

    if (!referrerBonus || !newUserBonus || referrerBonus < 0 || newUserBonus < 0) {
      req.session.error = 'Please provide valid bonus amounts';
      return res.redirect('/admin/referral-settings');
    }

    await Config.findOneAndUpdate(
      { key: 'referrer_bonus_amount' },
      { value: parseInt(referrerBonus), updatedAt: new Date() },
      { upsert: true }
    );

    await Config.findOneAndUpdate(
      { key: 'new_user_bonus_amount' },
      { value: parseInt(newUserBonus), updatedAt: new Date() },
      { upsert: true }
    );

    req.session.success = 'Referral settings updated successfully';
    res.redirect('/admin/referral-settings');
  } catch (error) {
    console.error('Error updating referral settings:', error);
    req.session.error = 'Failed to update referral settings';
    res.redirect('/admin/referral-settings');
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
  salesPage,
  exportSalesReportPDF,
  exportSalesReportExcel,
  exportSalesReportCSV,
  getSalesChartData,
  getReturnRequestsPage,
  acceptReturnRequest,
  declineReturnRequest,
  acceptItemReturnRequest,
  declineItemReturnRequest,
  couponsPage,
  postCreateCoupon,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  softDeleteCoupon,
  reactivateCoupon,
  getReferralSettings,
  updateReferralSettings
};
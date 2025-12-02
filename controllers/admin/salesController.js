const pdf = require('html-pdf');
const ejs = require('ejs');
const path = require('path');
const ExcelJS = require('exceljs');
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

// Helper to compute IST (UTC+05:30) start and end of current day, returned in UTC
const IST_OFFSET_MINUTES = 330;
function getISTStartEndOfToday(baseDate = new Date()) {
  const istNow = new Date(baseDate.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const istStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
  const istEnd = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate() + 1);
  const utcStart = new Date(istStart.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
  const utcEnd = new Date(istEnd.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
  return { utcStart, utcEnd };
}

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

    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const { utcStart: sod1, utcEnd: eod1 } = getISTStartEndOfToday(now);
        dateQuery = { orderDate: { $gte: sod1, $lt: eod1 } };
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

    const allMatchingOrders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name');

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

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name')
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit);

    const sales = orders.map(order => ({
      id: order._id.toString(),
      orderDate: order.orderDate.toISOString().split('T')[0],
      customerName: order.userId?.fullName || 'Unknown',
      paymentMethod: order.paymentMethod,
      couponUsed: order.coupon?.code || 'N/A',
      totalAmount: order.totalAmount + (order.coupon?.discountAmount || 0),
      discount: order.coupon?.discountAmount || 0,
      netPaidAmount: order.totalAmount,
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

const getSalesData = async (req, res) => {
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

    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const { utcStart: sod2, utcEnd: eod2 } = getISTStartEndOfToday(now);
        dateQuery = { orderDate: { $gte: sod2, $lt: eod2 } };
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

    const allMatchingOrders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name');

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

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .populate('items.productId', 'name')
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit);

    const sales = orders.map(order => ({
      id: order._id.toString(),
      orderDate: order.orderDate.toISOString().split('T')[0],
      customerName: order.userId?.fullName || 'Unknown',
      paymentMethod: order.paymentMethod,
      couponUsed: order.coupon?.code || 'N/A',
      totalAmount: order.totalAmount + (order.coupon?.discountAmount || 0),
      discount: order.coupon?.discountAmount || 0,
      netPaidAmount: order.totalAmount,
      orderStatus: order.status,
      productsList: order.items.map(item => ({
        name: item.productId?.name || item.name,
        quantity: item.quantity,
        price: item.salesPrice
      }))
    }));

    res.json({
      success: true,
      sales,
      analytics,
      currentPage: parseInt(page),
      totalPages: Math.ceil(allMatchingOrders.length / limit),
      search,
      status,
      sort,
      dateFilter,
      startDate,
      endDate,
      paymentMethod
    });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({ success: false, message: "Server Error" });
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

    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const { utcStart: sod3, utcEnd: eod3 } = getISTStartEndOfToday(now);
        dateQuery = { orderDate: { $gte: sod3, $lt: eod3 } };
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

    const filePath = path.join(__dirname, '../../views/admin/salesReportPdf.ejs');

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

    const now = new Date();
    let dateQuery = {};

    switch (dateFilter) {
      case 'today':
        const { utcStart: sod3, utcEnd: eod3 } = getISTStartEndOfToday(now);
        dateQuery = { orderDate: { $gte: sod3, $lt: eod3 } };
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.addRow([
      'Date',
      'Customer',
      'Payment Method',
      'Subtotal',
      'Discount',
      'Coupon Code',
      'Total Amount',
      'Status'
    ]);

    sales.forEach(sale => {
      worksheet.addRow([
        sale.date,
        sale.customer,
        sale.paymentMethod,
        sale.subtotal,
        sale.discount,
        sale.couponCode,
        sale.totalAmount,
        sale.status
      ]);
    });

    worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total Sales',
      analytics.totalSales,
      ''
    ]);

    worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total Orders',
      analytics.totalOrders,
      ''
    ]);

    worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total Products Sold',
      analytics.totalProductsSold,
      ''
    ]);

    worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total Discounts',
      analytics.totalDiscounts,
      ''
    ]);

    worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total Returns',
      analytics.totalReturns,
      ''
    ]);

    worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Net Revenue',
      analytics.netRevenue,
      ''
    ]);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=sales_report_${new Date().toISOString().split('T')[0]}.xlsx`
    });

    return res.send(await workbook.xlsx.writeBuffer());
  } catch (error) {
    console.error("Error generating sales report Excel:", error);
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

module.exports = {
    salesPage,
    getSalesData,
    exportSalesReportPDF,
    exportSalesReportExcel,
    getSalesChartData
}
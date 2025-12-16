const puppeteer = require('puppeteer')
const ejs = require('ejs');
const path = require('path');
const ExcelJS = require('exceljs');
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const mongoose = require('mongoose');

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

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
        const base = new Date();
        const startOfWeek = new Date(base);
        startOfWeek.setDate(base.getDate() - base.getDay());

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
        const base = new Date();
        const startOfWeek = new Date(base);
        startOfWeek.setDate(base.getDate() - base.getDay());

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
        const base = new Date();
        const startOfWeek = new Date(base);
        startOfWeek.setDate(base.getDate() - base.getDay());

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

      (async () => {
        try {
          const browser = await getBrowser();

          const page = await browser.newPage();

          await page.setContent(html, {
            waitUntil: 'networkidle0'
          });

          const buffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
              top: '10mm',
              right: '10mm',
              bottom: '10mm',
              left: '10mm'
            }
          });

          res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=sales_report_${new Date().toISOString().split('T')[0]}.pdf`,
            'Content-Length': buffer.length
          });

          return res.send(buffer);
        } catch (err) {
          console.error("Puppeteer PDF error:", err);
          return res.status(500).send("Could not generate PDF");
        }
      })();
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
      const base = new Date();
      const startOfWeek = new Date(base);
      startOfWeek.setDate(base.getDate() - base.getDay());

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

// Top 10 products by quantity sold
const getTopProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const pipeline = [
      { $match: { status: { $nin: ['Cancelled', 'Payment Failed'] } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
      { $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.salesPrice'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: limit }
    ];
    const results = await Order.aggregate(pipeline);
    res.json({ success: true, items: results });
  } catch (error) {
    console.error('getTopProducts error:', error);
    res.status(500).json({ success: false, message: 'Failed to load top products' });
  }
};

// Top 10 categories by quantity sold
const getTopCategories = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const pipeline = [
      { $match: { status: { $nin: ['Cancelled', 'Payment Failed'] } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $lookup: { from: 'categories', localField: 'prod.category', foreignField: '_id', as: 'cat' } },
      { $unwind: '$cat' },
      { $group: {
          _id: '$cat._id',
          name: { $first: '$cat.name' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.salesPrice'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: limit }
    ];
    const results = await Order.aggregate(pipeline);
    res.json({ success: true, items: results });
  } catch (error) {
    console.error('getTopCategories error:', error);
    res.status(500).json({ success: false, message: 'Failed to load top categories' });
  }
};

// Top 10 brands by quantity sold
const getTopBrands = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const pipeline = [
      { $match: { status: { $nin: ['Cancelled', 'Payment Failed'] } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: {
          _id: '$prod.brand',
          name: { $first: '$prod.brand' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.salesPrice'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: limit }
    ];
    const results = await Order.aggregate(pipeline);
    res.json({ success: true, items: results });
  } catch (error) {
    console.error('getTopBrands error:', error);
    res.status(500).json({ success: false, message: 'Failed to load top brands' });
  }
};

// Sales chart data (supports range & legacy period)
const getSalesChartData = async (req, res) => {
  try {
    const { range, year, month, startDate: sDate, endDate: eDate, period } = req.query;
    const now = new Date();

    const mode = range || period || 'month';

    function startOfISTDay(date) {
      const d = new Date(date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    function endOfISTDay(date) {
      const d = new Date(date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }

    let from, to;
    if (mode === 'year') {
      const y = parseInt(year) || now.getFullYear();
      from = new Date(y, 0, 1);
      to = new Date(y + 1, 0, 1);
    } else if (mode === 'month') {
      const y = parseInt(year) || now.getFullYear();
      const m = month !== undefined ? parseInt(month) : now.getMonth();
      from = new Date(y, m, 1);
      to = new Date(y, m + 1, 1);
    } else if (mode === 'week') {
      const d = new Date();
      const day = d.getDay();
      const mondayOffset = (day + 6) % 7; // Monday-start week
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset);
      from = startOfISTDay(monday);
      to = new Date(from);
      to.setDate(from.getDate() + 7);
    } else if (mode === 'day') {
      from = startOfISTDay(now);
      to = endOfISTDay(now);
    } else if (mode === 'custom' && sDate && eDate) {
      from = startOfISTDay(new Date(sDate));
      to = endOfISTDay(new Date(eDate));
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    let groupId;
    let labelFormat = 'daily';
    if (mode === 'year') {
      groupId = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
      labelFormat = 'monthly';
    } else {
      groupId = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
      labelFormat = 'daily';
    }

    const salesData = await Order.aggregate([
      { $match: { orderDate: { $gte: from, $lt: to }, status: { $nin: ['Cancelled', 'Payment Failed', 'Returned'] } } },
      { $group: { _id: groupId, totalSales: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const labels = salesData.map(d => d._id);
    const datasets = { revenue: salesData.map(d => d.totalSales), orders: salesData.map(d => d.totalOrders) };

    res.json({ success: true, labels, datasets, data: salesData, range: mode, dateFormat: labelFormat });
  } catch (error) {
    console.error('Error getting sales chart data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  salesPage,
  getSalesData,
  exportSalesReportPDF,
  exportSalesReportExcel,
  getSalesChartData,
  getTopProducts,
  getTopCategories,
  getTopBrands
};
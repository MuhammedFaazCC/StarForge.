const puppeteer = require("puppeteer");
const Order = require("../../models/orderSchema");
const chromiumPath = puppeteer.executablePath();

const downloadInvoice = async (req, res) => {
  let browser; // must be declared outside

  try {
    const { _id } = req.params;
    const userId = req.session.user._id;

    // Fetch the order
    let order = await Order.findOne({ _id, userId })
      .populate('items.productId')
      .populate('userId');

    if (!order) {
      order = await Order.findOne({ orderId: _id, userId })
        .populate('items.productId')
        .populate('userId');
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const discountAmount = order?.coupon?.discountAmount || 0;
    const totalSales = order.items.reduce(
      (sum, item) => sum + (item.salesPrice || 0) * (item.quantity || 0),
      0
    );

    const itemsWithAdjustedPrice = order.items.map(item => {
      const itemTotal = (item.salesPrice || 0) * (item.quantity || 0);
      const share = totalSales > 0 ? (itemTotal / totalSales) * discountAmount : 0;
      const adjustedTotal = itemTotal - share;
      return {
        name: item.name,
        quantity: item.quantity,
        adjustedUnitPrice: item.quantity ? adjustedTotal / item.quantity : 0,
        adjustedTotal
      };
    });

    const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${order._id}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border: 1px solid #ddd;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #fca120;
          padding-bottom: 20px;
        }
        .company-name {
          font-size: 32px;
          font-weight: bold;
          color: #fca120;
          margin-bottom: 5px;
        }
        .invoice-title {
          font-size: 24px;
          color: #333;
          margin-top: 15px;
        }
        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .invoice-details, .billing-details {
          width: 48%;
        }
        .invoice-details h3, .billing-details h3 {
          color: #fca120;
          margin-bottom: 10px;
          font-size: 16px;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
        }
        .detail-row {
          margin-bottom: 8px;
          display: flex;
        }
        .detail-label {
          font-weight: bold;
          width: 120px;
          color: #555;
        }
        .detail-value {
          color: #333;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
        }
        .items-table th {
          background-color: #fca120;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
        }
        .items-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #eee;
        }
        .items-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .totals-section {
          margin-top: 30px;
          border-top: 2px solid #fca120;
          padding-top: 20px;
        }
        .totals-table {
          width: 100%;
          max-width: 400px;
          margin-left: auto;
        }
        .totals-table td {
          padding: 8px 15px;
          border-bottom: 1px solid #eee;
        }
        .totals-table .total-label {
          font-weight: bold;
          text-align: right;
          color: #555;
        }
        .totals-table .total-value {
          text-align: right;
          font-weight: bold;
          color: #333;
        }
        .final-total {
          background-color: #fca120;
          color: white;
          font-size: 18px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #eee;
          color: #666;
          font-size: 12px;
        }
        .payment-method {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #fca120;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .status-delivered {
          background-color: #d4edda;
          color: #155724;
        }
        .status-cancelled {
          background-color: #f8d7da;
          color: #721c24;
        }
        .status-pending {
          background-color: #fff3cd;
          color: #856404;
        }
        .status-processing {
          background-color: #cce7ff;
          color: #004085;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-name">StarForge</div>
          <div class="invoice-title">INVOICE</div>
        </div>

        <!-- Invoice and Billing Information -->
        <div class="invoice-info">
          <div class="invoice-details">
            <h3>Invoice Details</h3>
            <div class="detail-row">
              <span class="detail-label">Invoice No:</span>
              <span class="detail-value">${order.orderId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${order.createdAt.toLocaleDateString('en-GB')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value">
                <span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span>
              </span>
            </div>
          </div>
          
          <div class="billing-details">
            <h3>Billing To</h3>
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${order.userId.fullName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${order.userId.email}</span>
            </div>
            ${order.userId.mobile ? `
            <div class="detail-row">
              <span class="detail-label">Mobile:</span>
              <span class="detail-value">${order.userId.mobile}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Address:</span>
              <span class="detail-value">${order.address}</span>
            </div>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="payment-method">
          <strong>Payment Method:</strong> 
          ${order.paymentMethod === 'Online' ? 'Razorpay (Online Payment)' : 
            order.paymentMethod === 'COD' ? 'Cash on Delivery' : 
            order.paymentMethod === 'Wallet' ? 'Wallet Payment' : order.paymentMethod}
        </div>

        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th class="text-center">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsWithAdjustedPrice.map(item => `
              <tr>
                <td>
                  <strong>${item.name || 'Unknown Product'}</strong>
                  ${item.status && item.status !== 'Ordered' ? `<br><span class="status-badge status-${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span>` : ''}
                </td>
                <td class="text-center">${item.quantity || 0}</td>
                <td class="text-right">₹${(item.adjustedUnitPrice || 0).toFixed(2)}</td>
                <td class="text-right">₹${(item.adjustedTotal || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals Section -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="total-label">Subtotal:</td>
              <td class="total-value">₹${(order.totalAmount + discountAmount).toFixed(2)}</td>
            </tr>
            ${discountAmount > 0 ? `
            <tr>
              <td class="total-label">Discount (${order.coupon?.code || 'Coupon'}):</td>
              <td class="total-value">-₹${discountAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="final-total">
              <td class="total-label">Total Paid:</td>
              <td class="total-value">₹${order.totalAmount.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p><strong>Thank you for your business!</strong></p>
          <p>This is a computer-generated invoice.</p>
          <p>For any queries, please contact our support team.</p>
          <p>StarForge - Your trusted partner</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // PDF generation options
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      header: {
        height: '0mm'
      },
      footer: {
        height: '0mm'
      }
    };

    // Generate PDF
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      executablePath: puppeteer.executablePath()
    });

    const page = await browser.newPage();

    await page.setContent(invoiceHTML, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice_${order.orderId}.pdf"`
    });

    return res.send(pdfBuffer);

  } catch (error) {
    console.error("Invoice generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice"
    });

  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
};

module.exports = {
    downloadInvoice
}
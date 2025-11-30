const Coupon = require("../../models/couponSchema");

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
        minimumAmount: coupon.minimumAmount || 0,
        maxAmount: coupon.maxAmount || 0
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
    const { code, discount, expiryDate, usageLimit, minimumAmount, maxAmount } = req.body;
    const maxAmt = maxAmount ? parseFloat(maxAmount) : 0;
    console.log(maxAmount);

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

    if (maxAmt < 0) {
      return res.json({ success: false, message: "Maximum discount amount cannot be negative" });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      expiryDate: new Date(expiryDate),
      usageLimit: parseInt(usageLimit),
      minimumAmount: minAmount,
      maxAmount: maxAmt,
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
    const { code, discount, expiryDate, usageLimit, minimumAmount, maxAmount } = req.body;

    if (!code || !discount || !expiryDate || !usageLimit) {
      return res.json({ success: false, message: "All required fields must be filled" });
    }

    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

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

    const maxAmt = maxAmount ? parseFloat(maxAmount) : 0;
    if (maxAmt < 0) {
      return res.json({ success: false, message: "Maximum discount amount cannot be negative" });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, {
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      expiryDate: new Date(expiryDate),
      usageLimit: parseInt(usageLimit),
      minimumAmount: minAmount,
      maxAmount: maxAmt
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
    const { force } = req.query;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid coupon ID" });
    }

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

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

    const totalUsageCount = coupon.usedBy.reduce((total, usage) => total + usage.usedCount, 0);
    const hasUsageHistory = totalUsageCount > 0;

    if (hasUsageHistory && force !== 'true') {
      return res.status(400).json({ 
        success: false, 
        message: `Coupon "${coupon.code}" has been used ${totalUsageCount} time(s). You can either permanently delete it (losing usage history) or deactivate it to preserve the data.`,
        canSoftDelete: true,
        usageCount: totalUsageCount
      });
    }

    if (force === 'true') {
      await Coupon.findByIdAndDelete(id);
      console.log(`Coupon force deleted: ${coupon.code} (ID: ${id})`);
      res.status(200).json({ 
        success: true, 
        message: `Coupon "${coupon.code}" permanently deleted` 
      });
    } else {
      await Coupon.findByIdAndDelete(id);
      console.log(`Coupon deleted successfully: ${coupon.code} (ID: ${id})`);
      res.status(200).json({ 
        success: true, 
        message: `Coupon "${coupon.code}" deleted successfully` 
      });
    }
    
  } catch (error) {
    console.error("Error deleting coupon:", error);
    
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

    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reactivate coupon "${coupon.code}" as it has expired. Please create a new coupon or extend the expiry date.` 
      });
    }

    coupon.status = 'Active';
    coupon.reactivatedAt = new Date();
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
    
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: "Invalid coupon ID format" });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to reactivate coupon. Please try again." 
    });
  }
};

module.exports = {
    couponsPage,
    postCreateCoupon,
    getCoupon,
    updateCoupon,
    deleteCoupon,
    softDeleteCoupon,
    reactivateCoupon,
}
const Address = require("../../models/addressSchema");


const getAddressList = async (req, res) => {
  const user = req.session.user;
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  try {
    const addresses = await Address.find({ userId: user._id }).sort({ createdAt: -1 });

    const cartCount = typeof getCartCount === "function" ? await getCartCount(user._id) : 0;

    res.render("profileAddressList", { user, addresses, error, success, cartCount });
  } catch (err) {
    console.error("Error loading addresses:", err.message);
    res.render("profileAddressList", { 
      user, 
      addresses: [], 
      error: "Failed to load addresses", 
      success: null, 
      cartCount: 0 
    });
  }
};

const getAddAddress = async (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  res.render("profileAddAddress", {
    currentPage: "address",
    user: req.session.user,
    error,
    success
  });
};

const addAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      req.session.error = "Please log in to add an address";
      return res.redirect("/login");
    }

    const userId = req.session.user._id;
    const { name, phone, address, district, state, city, pinCode, isDefault } = req.body;

    const validationErrors = {};

    // Helper to title case words
    const toTitle = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    // Validate fields (server-side rules)
    const nameVal = (name || '').trim();
    const phoneVal = (phone || '').trim();
    const addressVal = (address || '').trim();
    const districtVal = (district || '').trim();
    const stateVal = (state || '').trim();
    const cityVal = (city || '').trim();
    const pinVal = (pinCode || '').trim();

    if (!nameVal || nameVal.length < 2 || nameVal.length > 100 || !/^[A-Za-z .]+$/.test(nameVal)) {
      validationErrors.name = "Full name must be 2-100 characters and contain only letters, spaces, or dots";
    }
    if (!phoneVal || !/^\d{10}$/.test(phoneVal)) {
      validationErrors.phone = "Phone number must be exactly 10 digits";
    }
    if (!addressVal || addressVal.length < 5 || addressVal.length > 200) {
      validationErrors.address = "Address must be between 5 and 200 characters";
    }
    if (!districtVal || districtVal.length < 2 || districtVal.length > 50 || !/^[A-Za-z ]+$/.test(districtVal)) {
      validationErrors.district = "District must be 2-50 letters (letters and spaces only)";
    }
    if (!stateVal || stateVal.length < 2 || stateVal.length > 50 || !/^[A-Za-z ]+$/.test(stateVal)) {
      validationErrors.state = "State must be 2-50 letters (letters and spaces only)";
    }
    if (!cityVal || cityVal.length < 2 || cityVal.length > 50 || !/^[A-Za-z ]+$/.test(cityVal)) {
      validationErrors.city = "City must be 2-50 letters (letters and spaces only)";
    }
    if (!pinVal || !/^\d{6}$/.test(pinVal)) {
      validationErrors.pinCode = "Pin code must be exactly 6 digits";
    }

    if (Object.keys(validationErrors).length > 0) {
      req.session.error = "Validation failed. Please correct the highlighted fields.";
      return res.redirect("/address/add");
    }

    // Prevent duplicate phone
    const existingPhone = await Address.findOne({ userId, phone: phoneVal });
    if (existingPhone) {
      req.session.error = "An address with this phone number already exists";
      return res.redirect("/address/add");
    }

    const defaultFlag = isDefault === "true" || isDefault === true || isDefault === "on" || isDefault === "1";
    if (defaultFlag) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const newAddress = new Address({
      userId,
      name: toTitle(nameVal),
      phone: phoneVal,
      address: addressVal,
      district: toTitle(districtVal),
      state: toTitle(stateVal),
      city: toTitle(cityVal),
      pinCode: pinVal,
      isDefault: defaultFlag
    });

    await newAddress.save();

    // If first address, set as selected
    const addressCount = await Address.countDocuments({ userId });
    if (addressCount === 1) {
      req.session.selectedAddressId = newAddress._id.toString();
    }

    req.session.success = "Address added successfully";
    return res.redirect("/address");
  } catch (error) {
    console.error("Add address error:", error);
    req.session.error = "Failed to add address";
    return res.redirect("/address/add");
  }
};

const editAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to edit an address" });
    }

    const userId = req.session.user._id;
    const addressId = req.params.id;
    const { name, phone, address, district, state, city, pinCode, isDefault } = req.body;

    const validationErrors = {};

    // Same validation as addAddress
    if (!name || name.trim().length < 2 || !/^[a-zA-Z\s]+$/.test(name.trim())) {
      validationErrors.name = "Name must be at least 2 letters and contain only alphabets";
    }
    if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
      validationErrors.phone = "Phone number must be 10 digits starting with 6, 7, 8, or 9";
    }
    if (!address || address.trim().length < 10) {
      validationErrors.address = "Address must be at least 10 characters long";
    }
    if (!district || district.trim().length < 2 || !/^[a-zA-Z\s]+$/.test(district.trim())) {
      validationErrors.district = "District must contain only letters and be at least 2 characters long";
    }
    if (!state || state.trim().length < 2 || !/^[a-zA-Z\s]+$/.test(state.trim())) {
      validationErrors.state = "State must contain only letters and be at least 2 characters long";
    }
    if (!city || city.trim().length < 2 || !/^[a-zA-Z\s]+$/.test(city.trim())) {
      validationErrors.city = "City must contain only letters and be at least 2 characters long";
    }
    if (!pinCode || !/^[1-9][0-9]{5}$/.test(pinCode.trim())) {
      validationErrors.pinCode = "Pin code must be 6 digits and cannot start with 0";
    }

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationErrors });
    }

    // Check duplicate phone (excluding current)
    const existingPhone = await Address.findOne({ userId, phone: phone.trim(), _id: { $ne: addressId } });
    if (existingPhone) {
      return res.status(400).json({ 
        success: false, 
        message: "An address with this phone number already exists",
        errors: { phone: "This phone number is already used in another address" }
      });
    }

    if (isDefault === "true" || isDefault === true) {
      await Address.updateMany({ userId, _id: { $ne: addressId } }, { $set: { isDefault: false } });
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { name: name.trim(), phone: phone.trim(), address: address.trim(), district: district.trim(), state: state.trim(), city: city.trim(), pinCode: pinCode.trim(), isDefault: isDefault === "true" || isDefault === true },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.error("Edit address error:", error);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.params.id;

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found or unauthorized" });
    }

    await Address.findByIdAndDelete(addressId);
    res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
};

const getAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to view address" });
    }

    const address = await Address.findById(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }
    res.json({ success: true, address });
  } catch (error) {
    console.error("Get address error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const selectAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to select an address" });
    }

    const { addressId } = req.body;
    const userId = req.session.user._id;

    if (!addressId) {
      return res.status(400).json({ success: false, message: "Address ID is required" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found or unauthorized" });
    }

    req.session.selectedAddressId = addressId.toString();
    res.json({ success: true, selectedAddressId: addressId });
  } catch (error) {
    console.error("Select address error:", error);
    res.status(500).json({ success: false, message: "Failed to select address" });
  }
};

module.exports = {
  getAddressList,
  getAddAddress,
  addAddress,
  editAddress,
  deleteAddress,
  getAddress,
  selectAddress
};

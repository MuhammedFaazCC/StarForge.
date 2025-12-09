const Address = require("../../models/addressSchema");

// Helper to title case words across controller
const toTitle = (s = '') => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

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

  const fieldErrors = req.session.fieldErrors || {};
  const formData = req.session.formData || {};

  req.session.error = null;
  req.session.success = null;
  req.session.fieldErrors = null;
  req.session.formData = null;

  res.render("profileAddAddress", {
    currentPage: "address",
    user: req.session.user,
    error,
    success,
    fieldErrors,
    formData
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
    const wantsJSON = req.xhr || (req.headers['content-type'] || '').includes('application/json') || (req.headers.accept || '').includes('application/json');

    // Validate fields (server-side rules)
    const nameVal = (name || '').trim();
    const phoneVal = (phone || '').trim();
    const addressVal = (address || '').trim();
    const districtVal = (district || '').trim();
    const stateVal = (state || '').trim();
    const cityVal = (city || '').trim();
    const pinVal = (pinCode || '').trim();

    if (!/^[A-Za-z .]{2,100}$/.test(nameVal)) {
        validationErrors.name = "Full name must be 2–100 letters (letters, spaces, dots allowed)";
    }
    if (!/^[6-9][0-9]{9}$/.test(phoneVal)) {
        validationErrors.phone = "Mobile number must be 10 digits and start with 6–9";
    }
    if (!/^[A-Za-z0-9 ,./\\-]{10,200}$/.test(addressVal)) {
        validationErrors.address = "Address must be 10–200 characters and contain valid characters only";
    }
    if (!/^[1-9][0-9]{5}$/.test(pinVal)) {
        validationErrors.pinCode = "Pincode must be 6 digits and cannot start with 0";
    }
    if (!/^[A-Za-z ]{2,50}$/.test(cityVal)) {
        validationErrors.city = "City must contain only letters and spaces";
    }
    if (!/^[A-Za-z ]{2,50}$/.test(districtVal)) {
        validationErrors.district = "District must contain only letters and spaces";
    }
    if (!/^[A-Za-z ]{2,50}$/.test(stateVal)) {
        validationErrors.state = "State must contain only letters and spaces";
    }

if (Object.keys(validationErrors).length > 0) {
  if (wantsJSON) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: validationErrors });
  } else {
    req.session.fieldErrors = validationErrors;
    req.session.formData = req.body;
    return res.redirect("/address/add");
  }
}


    // Prevent duplicate phone
    const existingPhone = await Address.findOne({ userId, phone: phoneVal });
    if (existingPhone) {
      if (wantsJSON) {
        return res.status(400).json({ success: false, message: "An address with this phone number already exists", errors: { phone: "This phone number is already used in another address" } });
      } else {
        req.session.error = "An address with this phone number already exists";
        return res.redirect("/address/add");
      }
    }

    const count = await Address.countDocuments({ userId });
    let defaultFlag = isDefault === "true" || isDefault === true || isDefault === "on" || isDefault === "1";
    if (count === 0) {
      defaultFlag = true; // first address automatically default
    }
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

    if (wantsJSON) {
      return res.status(201).json({ success: true, message: "Address added successfully", addressId: newAddress._id });
    } else {
      req.session.success = "Address added successfully";
      return res.redirect("/address");
    }
  } catch (error) {
    console.error("Add address error:", error);
    if (req.xhr || (req.headers['content-type'] || '').includes('application/json') || (req.headers.accept || '').includes('application/json')) {
      return res.status(500).json({ success: false, message: "Failed to add address" });
    } else {
      req.session.error = "Failed to add address";
      return res.redirect("/address/add");
    }
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

    const nameVal = (name || '').trim();
    const phoneVal = (phone || '').trim();
    const addressVal = (address || '').trim();
    const districtVal = (district || '').trim();
    const stateVal = (state || '').trim();
    const cityVal = (city || '').trim();
    const pinVal = (pinCode || '').trim();

    if (!/^[A-Za-z .]{2,100}$/.test(nameVal)) {
        validationErrors.name = "Full name must be 2–100 letters (letters, spaces, dots allowed)";
    }
    if (!/^[6-9][0-9]{9}$/.test(phoneVal)) {
        validationErrors.phone = "Mobile number must be 10 digits and start with 6–9";
    }
    if (!/^[A-Za-z0-9 ,./\\-]{10,200}$/.test(addressVal)) {
        validationErrors.address = "Address must be 10–200 characters and contain valid characters only";
    }
    if (!/^[1-9][0-9]{5}$/.test(pinVal)) {
        validationErrors.pinCode = "Pincode must be 6 digits and cannot start with 0";
    }
    if (!/^[A-Za-z ]{2,50}$/.test(cityVal)) {
        validationErrors.city = "City must contain only letters and spaces";
    }
    if (!/^[A-Za-z ]{2,50}$/.test(districtVal)) {
        validationErrors.district = "District must contain only letters and spaces";
    }
    if (!/^[A-Za-z ]{2,50}$/.test(stateVal)) {
        validationErrors.state = "State must contain only letters and spaces";
    }

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationErrors });
    }

    // Check duplicate phone (excluding current)
    const existingPhone = await Address.findOne({ userId, phone: phoneVal, _id: { $ne: addressId } });
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
      { 
        name: toTitle(nameVal),
        phone: phoneVal,
        address: addressVal,
        district: toTitle(districtVal),
        state: toTitle(stateVal),
        city: toTitle(cityVal),
        pinCode: pinVal,
        isDefault: isDefault === "true" || isDefault === true 
      },
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

    const address = await Address.findOne({ _id: req.params.id, userId: req.session.user._id });
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
    req.session.selectedAddressId = addressId.toString();
    res.json({ success: true, selectedAddressId: addressId });
  } catch (error) {
    console.error("Select address error:", error);
    res.status(500).json({ success: false, message: "Failed to select address" });
  }
};

// Set an address as default for the logged-in user
const setDefaultAddress = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Please log in to update default address" });
    }

    const userId = req.session.user._id;
    const addressId = req.params.id;

    // Ensuring the address exists and belongs to the user
    const target = await Address.findOne({ _id: addressId, userId });
    if (!target) {
      return res.status(404).json({ success: false, message: "Address not found or unauthorized" });
    }

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    await Address.updateOne({ _id: addressId, userId }, { $set: { isDefault: true } });

    return res.json({ success: true, message: "Default address updated" });
  } catch (error) {
    console.error("Set default address error:", error);
    return res.status(500).json({ success: false, message: "Failed to update default address" });
  }
};

module.exports = {
  getAddressList,
  getAddAddress,
  addAddress,
  editAddress,
  deleteAddress,
  getAddress,
  selectAddress,
  setDefaultAddress
};

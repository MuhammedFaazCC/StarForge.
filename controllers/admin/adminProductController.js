const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const trimOrEmpty = (v) => (typeof v === "string" ? v.trim() : "");

const parsePositiveNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

const parseNonNegativeInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : NaN;
};

const allowedImageExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const getExt = (filename = "") => filename.slice(filename.lastIndexOf(".")).toLowerCase();

const validateImages = (files, { requireMainImage = false } = {}) => {
  const basePath = "/images/";
  const mainImage = files?.mainImage?.[0]
    ? basePath + files.mainImage[0].filename
    : "";
  const additionalImages = files?.additionalImages
    ? files.additionalImages.map((f) => basePath + f.filename)
    : [];

  if (requireMainImage && !mainImage) {
    return { ok: false, error: "Main image is required" };
  }

  // Validate extensions
  if (mainImage && !allowedImageExt.has(getExt(mainImage))) {
    return { ok: false, error: "Invalid main image type" };
  }
  for (const img of additionalImages) {
    if (!allowedImageExt.has(getExt(img))) {
      return { ok: false, error: "Invalid additional image type" };
    }
  }

  return { ok: true, mainImage, additionalImages };
};

const validateAndNormalizePayload = async (payload, { isEdit = false, productId = null } = {}) => {
  const out = {};

  // Required fields
  out.name = trimOrEmpty(payload.name);
  out.brand = trimOrEmpty(payload.brand);
  out.category = payload.category;
  out.description = trimOrEmpty(payload.description || "");
  out.rimMaterial = trimOrEmpty(payload.rimMaterial || "");
  out.finish = trimOrEmpty(payload.finish || "");

  // Name validations
  if (!out.name) return { ok: false, error: "Name is required" };
  if (out.name.length < 2 || out.name.length > 100) {
    return { ok: false, error: "Name must be between 2 and 100 characters" };
  }

  // Unique name check
  const nameRegex = new RegExp(`^${out.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const nameQuery = { name: nameRegex };
  if (isEdit && productId) nameQuery._id = { $ne: productId };
  const dup = await Product.findOne(nameQuery).lean();
  if (dup) return { ok: false, error: "A product with this name already exists" };

  // Brand validations
  if (!out.brand) return { ok: false, error: "Brand is required" };
  if (out.brand.length < 2 || out.brand.length > 50) {
    return { ok: false, error: "Brand must be between 2 and 50 characters" };
  }

  // Price validations
  const parsedPrice = parsePositiveNumber(payload.price);
  if (!Number.isFinite(parsedPrice)) return { ok: false, error: "Price is required" };
  if (parsedPrice <= 0) return { ok: false, error: "Price must be greater than 0" };
  out.price = parsedPrice;

  // Offer validations
  let parsedOffer = payload.offer !== undefined && payload.offer !== null && payload.offer !== ""
    ? parsePositiveNumber(payload.offer)
    : 0;
  if (!Number.isFinite(parsedOffer)) parsedOffer = 0;
  if (parsedOffer < 0 || parsedOffer > 100) {
    parsedOffer = 0;
  }
  out.offer = parsedOffer;

  // Category validations
  if (!out.category || !isValidObjectId(out.category)) {
    return { ok: false, error: "Invalid category selected" };
  }
  const categoryDoc = await Category.findById(out.category).lean();
  if (!categoryDoc) return { ok: false, error: "Invalid category selected" };
  out.categoryOffer = Number.isFinite(categoryDoc.offer) ? categoryDoc.offer : 0;

  // Stock validations
  const parsedStock = parseNonNegativeInt(payload.stock);
  if (!Number.isFinite(parsedStock)) return { ok: false, error: "Stock is required" };
  if (parsedStock < 0) return { ok: false, error: "Stock cannot be negative" };
  out.stock = parsedStock;

  out.sizes = Array.isArray(payload.sizes)
    ? payload.sizes
    : (payload.sizes ? String(payload.sizes).split(",").map((s) => s.trim()).filter((s) => !!s) : []);

  // Optional fields length constraints
  if (out.rimMaterial.length > 50) {
    return { ok: false, error: "Rim material must be at most 50 characters" };
  }
  if (out.finish.length > 50) {
    return { ok: false, error: "Finish must be at most 50 characters" };
  }
  if (out.description.length > 500) {
    return { ok: false, error: "Description must be at most 500 characters" };
  }

  return { ok: true, data: out };
};

const computeSalesPrice = (price, productOffer, categoryOffer) => {
  const effectiveOffer = Math.max(productOffer || 0, categoryOffer || 0);
  const salesPrice = effectiveOffer > 0 ? price - (price * effectiveOffer) / 100 : price;
  return { effectiveOffer, salesPrice: parseFloat(salesPrice.toFixed(2)) };
};

const productsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments({ isDeleted: false });
    const products = await Product.find({ isDeleted: false })
      .populate("category")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);
    const totalPages = Math.ceil(totalProducts / limit);
    let message = req.session.message;
    req.session.message = null;

    res.render("products", {
      products,
      currentPage: page,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      message,
    });
  } catch (err) {
    console.error("Error loading products page:", err);
    res.render("products", {
      products: [],
      currentPage: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: 1,
      nextPage: 1,
      message: {
        success: false,
        text: "Error loading products. Please try again.",
      },
    });
  }
};

const addProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    return res.render("addProducts", { message: null, categories });
  } catch (err) {
    console.error("Error loading add product page:", err);
    res.render("addProducts", {
      message: {
        success: false,
        text: "Error loading categories. Please refresh and try again.",
      },
      categories: [],
    });
  }
};

const productAdd = async (req, res) => {
  try {
    // Validate and normalize core fields
    const v = await validateAndNormalizePayload(req.body, { isEdit: false });
    if (!v.ok) {
      return res.status(400).json({ success: false, message: v.error });
    }
    const core = v.data;

    // Validate images (mainImage required on add)
    const img = validateImages(req.files, { requireMainImage: true });
    if (!img.ok) {
      return res.status(400).json({ success: false, message: img.error });
    }

    // Compute pricing
    const { effectiveOffer, salesPrice } = computeSalesPrice(core.price, core.offer, core.categoryOffer);

    const newProduct = new Product({
      name: core.name,
      brand: core.brand,
      price: core.price,
      offer: core.offer,
      categoryOffer: core.categoryOffer,
      salesPrice,
      description: core.description,
      category: core.category,
      sizes: core.sizes,
      rimMaterial: core.rimMaterial,
      finish: core.finish,
      stock: core.stock,
      mainImage: img.mainImage,
      additionalImages: img.additionalImages,
      isDeleted: false,
      isListed: true,
    });

    await newProduct.save();

    return res.status(200).json({
      success: true,
      message: `Product "${core.name}" has been added successfully!`,
      effectiveOffer,
    });
  } catch (err) {
    console.error("Error adding product:", err);
    let errorMessage = "Failed to add product. Please try again.";
    if (err.code === 11000) {
      errorMessage = "A product with this name already exists.";
    } else if (err.name === "ValidationError") {
      errorMessage = "Please check your input data and try again.";
    }
    return res.status(500).json({ success: false, message: errorMessage });
  }
};

const viewProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product) {
      req.session.message = {
        success: false,
        text: "Product not found",
      };
      return res.redirect("/admin/products");
    }
    res.render("viewProduct", { product });
  } catch (error) {
    console.error("Error loading product view page:", error);
    req.session.message = {
      success: false,
      text: "Error loading product details",
    };
    res.redirect("/admin/products");
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      req.session.message = {
        success: false,
        text: "Invalid product ID",
      };
      return res.redirect("/admin/products");
    }

    const product = await Product.findById(productId).lean();
    const categories = await Category.find({ isActive: true }).lean();

    if (!product) {
      req.session.message = {
        success: false,
        text: "Product not found",
      };
      return res.redirect("/admin/products");
    }

    res.render("editProduct", {
      product,
      categories,
      message: null,
    });
  } catch (err) {
    console.error("Error loading product edit page:", err);
    req.session.message = {
      success: false,
      text: "Error loading product for editing",
    };
    res.redirect("/admin/products");
  }
};

const productEdit = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      req.session.message = { success: false, text: "Invalid product ID" };
      return res.redirect("/admin/products");
    }

    const product = await Product.findById(productId);
    if (!product) {
      req.session.message = { success: false, text: "Product not found" };
      return res.redirect("/admin/products");
    }

    // Validate core fields (edit mode)
    const v = await validateAndNormalizePayload(req.body, { isEdit: true, productId });
    if (!v.ok) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("editProduct", {
        product: product.toObject(),
        categories,
        message: { success: false, text: v.error },
      });
    }
    const core = v.data;

    // Validate images if provided (main image optional on edit)
    let baseMain = product.mainImage;
    let baseAdditional = Array.isArray(product.additionalImages) ? [...product.additionalImages] : [];

    // Handle remove flags from form
    const removeMain = req.body.removeMainImage === "true" || req.body.removeMainImage === "on";
    let removedAdditional = req.body.removedAdditional || [];
    if (!Array.isArray(removedAdditional) && removedAdditional) removedAdditional = [removedAdditional];

    if (removedAdditional.length) {
      const removedSet = new Set(removedAdditional);
      baseAdditional = baseAdditional.filter((img) => !removedSet.has(img));
    }

    // If new files uploaded, validate and merge
    if (req.files && (req.files.mainImage?.[0] || (req.files.additionalImages?.length || 0) > 0)) {
      const img = validateImages(req.files, { requireMainImage: false });
      if (!img.ok) {
        const categories = await Category.find({ isActive: true }).lean();
        return res.render("editProduct", {
          product: product.toObject(),
          categories,
          message: { success: false, text: img.error },
        });
      }
      if (img.mainImage) baseMain = img.mainImage; // replace main if provided
      if (img.additionalImages?.length) baseAdditional = baseAdditional.concat(img.additionalImages); // append new images
    }

    // If requested to remove main image and no replacement uploaded, clear it
    if (removeMain && !(req.files && req.files.mainImage?.[0])) {
      baseMain = "";
    }

    // Compute pricing
    const { effectiveOffer, salesPrice } = computeSalesPrice(core.price, core.offer, core.categoryOffer);

    // Update product
    product.name = core.name;
    product.brand = core.brand;
    product.price = core.price;
    product.offer = core.offer;
    product.categoryOffer = core.categoryOffer;
    product.description = core.description;
    product.category = core.category;
    product.stock = core.stock;
    product.sizes = core.sizes;
    product.rimMaterial = core.rimMaterial;
    product.finish = core.finish;
    product.salesPrice = salesPrice;
    product.mainImage = baseMain;
    product.additionalImages = baseAdditional;

    await product.save();

    req.session.message = {
      success: true,
      text: `Product "${product.name}" has been updated successfully!`,
    };
    res.redirect("/admin/products");
  } catch (err) {
    console.error("Error updating product:", err);

    let errorMessage = "Failed to update product. Please try again.";
    if (err.code === 11000) {
      errorMessage = "A product with this name already exists.";
    } else if (err.name === "ValidationError") {
      errorMessage = "Please check your input data and try again.";
    }

    try {
      const product = await Product.findById(req.params.id).lean();
      const categories = await Category.find({ isActive: true }).lean();
      res.render("editProduct", {
        product,
        categories,
        message: { success: false, text: errorMessage },
      });
    } catch (renderErr) {
      console.error("Error rendering edit page after update failure:", renderErr);
      req.session.message = { success: false, text: errorMessage };
      res.redirect("/admin/products");
    }
  }
};

const toggleListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { isListed } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { isListed: !!isListed },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: `Product is now ${
        updatedProduct.isListed ? "listed" : "unlisted"
      }`,
      isListed: updatedProduct.isListed,
    });
  } catch (err) {
    console.error("Error toggling product listing:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Product "${product.name}" has been permanently deleted`,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product. Please try again.",
    });
  }
};

module.exports = {
  productsPage,
  addProduct,
  productAdd,
  viewProduct,
  editProduct,
  productEdit,
  toggleListing,
  deleteProduct,
};

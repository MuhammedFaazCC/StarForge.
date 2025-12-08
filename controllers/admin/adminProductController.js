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

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

const validateImages = (files, { requireMainImage = false } = {}) => {
  const main = files?.mainImage?.[0];
  const additional = files?.additionalImages || [];

  if (requireMainImage && !main)
    return { ok: false, error: "Main image is required" };

  const checkFile = (f) => {
    const ext = getExt(f.originalname);
    if (!allowedImageExt.has(ext)) return "Invalid image format";
    if (f.size > MAX_IMAGE_SIZE) return "Image exceeds 2MB limit";
    return null;
  };

  if (main) {
    const err = checkFile(main);
    if (err) return { ok: false, error: err };
  }

  if (additional.length > 5) return { ok: false, error: "Max 5 additional images allowed" };

  for (const f of additional) {
    const err = checkFile(f);
    if (err) return { ok: false, error: err };
  }

  return {
    ok: true,
    mainImage: main ? "/images/" + main.filename : "",
    additionalImages: additional.map(f => "/images/" + f.filename),
  };
};

const sanitize = (s) =>
  typeof s === "string"
    ? s.replace(/[<>]/g, "").trim()
    : "";

const ALLOWED_SIZES = ["16", "17", "18", "19", "20", "21", "22"]; // adjust to your allowed list

const validateAndNormalizePayload = async (payload, { isEdit = false, productId = null } = {}) => {
  const out = {};

  // Sanitize + trim + normalize
  const name = sanitize(payload.name);
  const brand = sanitize(payload.brand);
  const description = sanitize(payload.description || "");
  const rimMaterial = sanitize(payload.rimMaterial || "");
  const color = sanitize(payload.color || "");
  const category = payload.category;
  const stockRaw = payload.stock;
  const priceRaw = payload.price;
  const offerRaw = payload.offer;
  const sizesRaw = payload.sizes;

  // Validate Product Name
  if (!name) return { ok: false, error: "Product name is required" };
  if (name.length < 2 || name.length > 100)
    return { ok: false, error: "Product name must be 2–100 characters" };

  if (!/^[A-Za-z0-9\s\-']+$/.test(name))
    return { ok: false, error: "Product name contains invalid characters" };

  if (!/[A-Za-z0-9]/.test(name))
    return { ok: false, error: "Product name must contain at least one alphanumeric character" };

  if (/---+/.test(name))
    return { ok: false, error: "Product name cannot contain repeated hyphens" };

  if (/^[-']|[-']$/.test(name))
    return { ok: false, error: "Product name cannot start or end with hyphens or apostrophes" };
  out.name = name;

  const nameRegex = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const nameQuery = { name: nameRegex };
  if (isEdit && productId) nameQuery._id = { $ne: productId };
  const dup = await Product.findOne(nameQuery).lean();
  if (dup) return { ok: false, error: "A product with this name already exists" };

  // Brand
  const brandName = brand;

  if (!brandName) return { ok: false, error: "Brand is required" };

  if (brandName.length < 2 || brandName.length > 50)
    return { ok: false, error: "Brand must be 2–50 characters" };

  if (!/^[A-Za-z0-9\s\-']+$/.test(brandName))
    return { ok: false, error: "Brand contains invalid characters" };

  if (!/[A-Za-z0-9]/.test(brandName))
    return { ok: false, error: "Brand must contain at least one alphanumeric character" };

  if (/^[^A-Za-z0-9]+$/.test(brandName))
    return { ok: false, error: "Brand cannot be only special characters" };

  if (/---+/.test(brandName))
    return { ok: false, error: "Brand cannot contain repeated hyphens" };

  if (/^[-']|[-']$/.test(brandName))
    return { ok: false, error: "Brand cannot start or end with hyphens or apostrophes" };

  if (/[<>]/.test(brandName))
    return { ok: false, error: "Brand cannot contain < or > characters" };

  out.brand = brandName;


  // Price
  const priceStr = String(priceRaw).trim();

  if (!priceStr) return { ok: false, error: "Price is required" };

  if (!/^\d+(\.\d{1,2})?$/.test(priceStr))
    return { ok: false, error: "Price must be a valid number with up to 2 decimals" };

  if (priceStr.startsWith("."))
    return { ok: false, error: "Price cannot start with a dot" };

  if (/^0\d+/.test(priceStr))
    return { ok: false, error: "Invalid leading zeros in price" };

  const priceNum = parseFloat(priceStr);

  if (!(priceNum > 0))
    return { ok: false, error: "Price must be greater than 0" };

  if (priceStr.length > 15)
    return { ok: false, error: "Price value is too large" };

  out.price = priceNum;


  // Offer
  let offerStr = String(offerRaw ?? "").trim();

  if (offerStr === "") offerStr = "0";

  if (!/^\d+$/.test(offerStr))
    return { ok: false, error: "Offer must be a whole number" };

  if (offerStr.length > 1 && offerStr.startsWith("0"))
    return { ok: false, error: "Offer cannot contain leading zeros" };

  const offerNum = parseInt(offerStr, 10);

  if (offerNum < 0 || offerNum > 90)
    return { ok: false, error: "Offer must be between 0 and 90%" };

  if (offerStr.length > 2)
    return { ok: false, error: "Invalid offer value" };

  out.offer = offerNum;


  // Description
  const desc = description;

  if (desc.length > 2000)
    return { ok: false, error: "Description must be ≤ 2000 characters" };

  if (desc && !/[A-Za-z0-9]/.test(desc))
    return { ok: false, error: "Description must contain at least one alphanumeric character" };

  if (/^[^A-Za-z0-9]+$/.test(desc))
    return { ok: false, error: "Description cannot be only special characters" };

  if (/([^\w\s])\1\1+/.test(desc))
    return { ok: false, error: "Description contains invalid repeated symbols" };

  if (/[<>]/.test(desc))
    return { ok: false, error: "Description cannot contain < or > characters" };

  if (/\n{4,}/.test(desc))
    return { ok: false, error: "Description contains excessive blank lines" };

  out.description = desc;


  // Category
  if (!category || !isValidObjectId(category))
    return { ok: false, error: "Invalid category" };
  const categoryDoc = await Category.findById(category).lean();
  if (!categoryDoc) return { ok: false, error: "Category does not exist" };
  out.category = category;
  out.categoryOffer = Number.isFinite(categoryDoc.offer) ? categoryDoc.offer : 0;

  // Stock
  const stock = parseInt(stockRaw, 10);
  if (!Number.isFinite(stock) || stock < 0) return { ok: false, error: "Stock must be an integer ≥ 0" };
  out.stock = stock;

  // Size (must match allowed values)
  let sizes = [];
  if (!sizesRaw) return { ok: false, error: "Size is required" };
  sizes = String(sizesRaw)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  for (const s of sizes) {
    if (!ALLOWED_SIZES.includes(s)) {
      return { ok: false, error: `Invalid size: ${s}` };
    }
  }
  out.sizes = sizes;

  // Rim Material
  const rm = rimMaterial;

  if (rm.length > 100)
    return { ok: false, error: "Rim material must be ≤ 100 characters" };

  if (rm) {
    if (!/^[A-Za-z0-9\s\-']+$/.test(rm))
      return { ok: false, error: "Rim material contains invalid characters" };

    if (!/[A-Za-z0-9]/.test(rm))
      return { ok: false, error: "Rim material must contain at least one alphanumeric character" };

    if (/^[^A-Za-z0-9]+$/.test(rm))
      return { ok: false, error: "Rim material cannot be only special characters" };

    if (/---+/.test(rm))
      return { ok: false, error: "Rim material cannot contain repeated hyphens" };

    if (/^[-']|[-']$/.test(rm))
      return { ok: false, error: "Rim material cannot start or end with hyphens or apostrophes" };

    if (/[<>]/.test(rm))
      return { ok: false, error: "Rim material cannot contain < or >" };

    if (/([^\w\s])\1\1+/.test(rm))
      return { ok: false, error: "Rim material contains repeated symbols" };
  }

  out.rimMaterial = rm;

  // Color
  const col = color;

  if (col.length > 50)
    return { ok: false, error: "Color must be ≤ 50 characters" };

  if (col) {
    if (!/^[A-Za-z0-9\s\-']+$/.test(col))
      return { ok: false, error: "Color contains invalid characters" };

    if (!/[A-Za-z0-9]/.test(col))
      return { ok: false, error: "Color must contain at least one alphanumeric character" };

    if (/^[^A-Za-z0-9]+$/.test(col))
      return { ok: false, error: "Color cannot be only special characters" };

    if (/---+/.test(col))
      return { ok: false, error: "Color cannot contain repeated hyphens" };

    if (/^[-']|[-']$/.test(col))
      return { ok: false, error: "Color cannot start or end with hyphens or apostrophes" };

    if (/[<>]/.test(col))
      return { ok: false, error: "Color cannot contain < or >" };

    if (/([^\w\s])\1\1+/.test(col))
      return { ok: false, error: "Color contains repeated symbols" };
  }

  out.color = col;


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

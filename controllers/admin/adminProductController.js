const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const allowedImageExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const getExt = (filename = "") => filename.slice(filename.lastIndexOf(".")).toLowerCase();

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const validateImages = (files, { requireMainImage = false } = {}) => {
  const main = files?.mainImage?.[0];
  const additional = files?.additionalImages || [];

  if (requireMainImage && !main) { return { ok: false, error: "Main image is required" }; }

  const checkFile = (f) => {
    const ext = getExt(f.originalname);
    if (!allowedImageExt.has(ext)) { return "Invalid image format"; }
    if (f.size > MAX_IMAGE_SIZE) { return "Image exceeds 2MB limit"; }
    return null;
  };

  if (main) {
    const err = checkFile(main);
    if (err) { return { ok: false, error: err }; }
  }

  if (additional.length > 5) { return { ok: false, error: "Max 5 additional images allowed" }; }

  for (const f of additional) {
    const err = checkFile(f);
    if (err) { return { ok: false, error: err }; }
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
  const category = payload.category;
  const offerRaw = payload.offer;

  // Validate Product Name
  if (!name) { return { ok: false, error: "Product name is required" }; }
  if (name.length < 2 || name.length > 100) { return { ok: false, error: "Product name must be 2–100 characters" }; }

  if (!/^[A-Za-z0-9\s\-']+$/.test(name)) { return { ok: false, error: "Product name contains invalid characters" }; }

  if (!/[A-Za-z0-9]/.test(name)) { return { ok: false, error: "Product name must contain at least one alphanumeric character" }; }

  if (/---+/.test(name)) { return { ok: false, error: "Product name cannot contain repeated hyphens" }; }

  if (/^[-']|[-']$/.test(name)) { return { ok: false, error: "Product name cannot start or end with hyphens or apostrophes" }; }
  out.name = name;

  const nameRegex = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const nameQuery = { name: nameRegex };
  if (isEdit && productId) { nameQuery._id = { $ne: productId }; }
  const dup = await Product.findOne(nameQuery).lean();
  if (dup) { return { ok: false, error: "A product with this name already exists" }; }

  // Brand
  const brandName = brand;

  if (!brandName) { return { ok: false, error: "Brand is required" }; }

  if (brandName.length < 2 || brandName.length > 50) { return { ok: false, error: "Brand must be 2–50 characters" }; }

  if (!/^[A-Za-z0-9\s\-']+$/.test(brandName)) { return { ok: false, error: "Brand contains invalid characters" }; }

  if (!/[A-Za-z0-9]/.test(brandName)) { return { ok: false, error: "Brand must contain at least one alphanumeric character" }; }

  if (/^[^A-Za-z0-9]+$/.test(brandName)) { return { ok: false, error: "Brand cannot be only special characters" }; }

  if (/---+/.test(brandName)) { return { ok: false, error: "Brand cannot contain repeated hyphens" }; }

  if (/^[-']|[-']$/.test(brandName)) { return { ok: false, error: "Brand cannot start or end with hyphens or apostrophes" }; }

  if (/[<>]/.test(brandName)) { return { ok: false, error: "Brand cannot contain < or > characters" }; }

  out.brand = brandName;


  // Global price validation is removed as price is derived from variants.


  // Offer
  let offerStr = String(offerRaw ?? "").trim();

  if (offerStr === "") { offerStr = "0"; }

  if (!/^\d+$/.test(offerStr)) { return { ok: false, error: "Offer must be a whole number" }; }

  if (offerStr.length > 1 && offerStr.startsWith("0")) { return { ok: false, error: "Offer cannot contain leading zeros" }; }

  const offerNum = parseInt(offerStr, 10);

  if (offerNum < 0 || offerNum > 90) { return { ok: false, error: "Offer must be between 0 and 90%" }; }

  if (offerStr.length > 2) { return { ok: false, error: "Invalid offer value" }; }

  out.offer = offerNum;


  // Description
  const desc = description;

  if (desc.length > 2000) { return { ok: false, error: "Description must be ≤ 2000 characters" }; }

  if (desc && !/[A-Za-z0-9]/.test(desc)) { return { ok: false, error: "Description must contain at least one alphanumeric character" }; }

  if (/^[^A-Za-z0-9]+$/.test(desc)) { return { ok: false, error: "Description cannot be only special characters" }; }

  if (/([^\w\s])\1\1+/.test(desc)) { return { ok: false, error: "Description contains invalid repeated symbols" }; }

  if (/[<>]/.test(desc)) { return { ok: false, error: "Description cannot contain < or > characters" }; }

  if (/\n{4,}/.test(desc)) { return { ok: false, error: "Description contains excessive blank lines" }; }

  out.description = desc;


  // Category
  if (!category || !isValidObjectId(category)) { return { ok: false, error: "Invalid category" }; }
  const categoryDoc = await Category.findById(category).lean();
  if (!categoryDoc) { return { ok: false, error: "Category does not exist" }; }
  out.category = category;
  out.categoryOffer = Number.isFinite(categoryDoc.offer) ? categoryDoc.offer : 0;

  // No longer validating global stock here, it will be calculated from variants.
  // No longer validating global sizes here, it is managed per-variant.

  // Rim Material
  const rm = rimMaterial;

  if (rm.length > 100) { return { ok: false, error: "Rim material must be ≤ 100 characters" }; }

  if (rm) {
    if (!/^[A-Za-z0-9\s\-']+$/.test(rm)) { return { ok: false, error: "Rim material contains invalid characters" }; }

    if (!/[A-Za-z0-9]/.test(rm)) { return { ok: false, error: "Rim material must contain at least one alphanumeric character" }; }

    if (/^[^A-Za-z0-9]+$/.test(rm)) { return { ok: false, error: "Rim material cannot be only special characters" }; }

    if (/---+/.test(rm)) { return { ok: false, error: "Rim material cannot contain repeated hyphens" }; }

    if (/^[-']|[-']$/.test(rm)) { return { ok: false, error: "Rim material cannot start or end with hyphens or apostrophes" }; }

    if (/[<>]/.test(rm)) { return { ok: false, error: "Rim material cannot contain < or >" }; }

    if (/([^\w\s])\1\1+/.test(rm)) { return { ok: false, error: "Rim material contains repeated symbols" }; }
  }

  out.rimMaterial = rm;

  // Global Color has been deprecated. Variants manage specific colors.
  out.color = "";


  // Variants
  const parsedVariants = [];
  const variantsPayload = payload.variantsPayload;
  let totalStock = 0;

  if (variantsPayload) {
    try {
      const vars = JSON.parse(variantsPayload);
      if (Array.isArray(vars) && vars.length > 0) {
        vars.forEach(v => {
          const attributes = {};
          if (v.Size) {attributes.Size = String(v.Size).trim();}
          if (v.Color) {attributes.Color = String(v.Color).trim();}

          const varPrice = Number(v.price);

          if (isNaN(varPrice) || varPrice <= 0) {
            throw new Error("Variant price is invalid or missing.");
          }

          const { effectiveOffer, salesPrice: varSalesPrice } = computeSalesPrice(varPrice, offerNum, categoryDoc ? out.categoryOffer : 0);

          const vStock = Number(v.stock) || 0;
          totalStock += vStock;

          parsedVariants.push({
            attributes,
            price: varPrice,
            stock: vStock,
            sku: String(v.sku || "").trim(),
            salesPrice: varSalesPrice
          });
        });
      }
    } catch (e) {
      console.error("Variants parse error", e);
    }
  }

  if (parsedVariants.length === 0) {
    return { ok: false, error: "At least one product variant (Size/Color) must be added." };
  }

  out.variants = parsedVariants;
  out.hasVariants = true;
  out.stock = totalStock;
  // Determine baseline price (lowest variant price)
  const lowestPri = Math.min(...parsedVariants.map(v => v.price));
  const lowestSales = Math.min(...parsedVariants.map(v => v.salesPrice));
  out.price = lowestPri;

  // This helps Category listing where product.salesPrice or product.price is displayed randomly
  // It handles it natively.
  out.salesPrice = lowestSales;

  out.sizes = [];

  return { ok: true, data: out };
};

const computeSalesPrice = (price, productOffer, categoryOffer) => {
  const effectiveOffer = Math.max(productOffer || 0, categoryOffer || 0);
  const salesPrice = effectiveOffer > 0 ? price - (price * effectiveOffer) / 100 : price;
  return { effectiveOffer, salesPrice: parseFloat(salesPrice.toFixed(2)) };
};

const productsPage = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 8;
    const skip = (page - 1) * limit;

    const search = (req.query.search || "").trim();

    const query = {
      isDeleted: false,
      ...(search && {
        name: { $regex: search, $options: "i" }
      })
    };

    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .populate("category")
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const totalPages = Math.max(Math.ceil(totalProducts / limit), 1);

    const message =
      req.session.message && typeof req.session.message === "object"
        ? req.session.message
        : null;

    delete req.session.message;

    return res.render("products", {
      products,
      currentPage: page,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      message,
      search
    });

  } catch (err) {
    console.error("Error loading products page:", err);

    return res.render("products", {
      products: [],
      currentPage: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: 1,
      nextPage: 1,
      message: {
        success: false,
        text: "Error loading products. Please try again."
      },
      search: ""
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
    // 1. Validate & normalize payload
    const v = await validateAndNormalizePayload(req.body, { isEdit: false });
    if (!v.ok) {
      return res.status(400).json({
        success: false,
        message: v.error
      });
    }

    // 2. Validate images
    const img = validateImages(req.files, { requireMainImage: true });
    if (!img.ok) {
      return res.status(400).json({
        success: false,
        message: img.error
      });
    }

    // 3. Compute baseline sales price (Already calculated sequentially in variants parser)
    // Removed duplicate execution here.

    // 4. Create product (ONLY validated data)
    const newProduct = new Product({
      name: core.name,
      brand: core.brand,
      description: core.description,
      price: core.price,
      offer: core.offer,
      category: core.category,
      categoryOffer: core.categoryOffer,
      stock: core.stock,
      sizes: core.sizes,
      rimMaterial: core.rimMaterial,
      color: core.color,

      salesPrice: core.salesPrice,
      effectiveOffer: core.offer || 0, // ensure offer carries forward if none was there

      mainImage: img.mainImage,
      additionalImages: img.additionalImages,

      isDeleted: false,
      isListed: true,
      variants: core.variants,
      hasVariants: core.hasVariants
    });

    await newProduct.save();

    // 5. Success (JSON only)
    return res.status(201).json({
      success: true,
      message: "Product added successfully"
    });

  } catch (err) {
    console.error("ADD PRODUCT ERROR:", err);

    // Duplicate key (name)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A product with this name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
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
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // 1. Validate core fields
    const v = await validateAndNormalizePayload(req.body, {
      isEdit: true,
      productId
    });

    if (!v.ok) {
      return res.status(400).json({
        success: false,
        message: v.error
      });
    }

    const core = v.data;

    // 2. Image handling
    let baseMain = product.mainImage;
    let baseAdditional = [...(product.additionalImages || [])];

    const removeMain =
      req.body.removeMainImage === "true" ||
      req.body.removeMainImage === "on";

    let removedAdditional = req.body.removedAdditional || [];
    if (!Array.isArray(removedAdditional) && removedAdditional) {
      removedAdditional = [removedAdditional];
    }

    if (removedAdditional.length) {
      const removeSet = new Set(removedAdditional);
      baseAdditional = baseAdditional.filter(img => !removeSet.has(img));
    }

    if (req.files && (req.files.mainImage?.[0] || req.files.additionalImages?.length)) {
      const img = validateImages(req.files, { requireMainImage: false });
      if (!img.ok) {
        return res.status(400).json({
          success: false,
          message: img.error
        });
      }

      if (img.mainImage) { baseMain = img.mainImage };
      if (img.additionalImages.length) { baseAdditional = baseAdditional.concat(img.additionalImages) };
    }

    if (removeMain && !req.files?.mainImage?.[0]) {
      baseMain = "";
    }

    // 3. Pricing
    // Sales prices natively determined during validateAndNormalizePayload via variants.

    // 4. Update
    product.name = core.name;
    product.brand = core.brand;
    product.description = core.description;
    product.price = core.price;
    product.offer = core.offer;
    product.category = core.category;
    product.categoryOffer = core.categoryOffer;
    product.stock = core.stock;
    product.sizes = core.sizes;
    product.rimMaterial = core.rimMaterial;
    product.color = core.color;
    product.salesPrice = core.salesPrice;
    product.mainImage = baseMain;
    product.additionalImages = baseAdditional;
    product.variants = core.variants;
    product.hasVariants = core.hasVariants;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully"
    });

  } catch (err) {
    console.error("EDIT PRODUCT ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A product with this name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
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
      message: `Product is now ${updatedProduct.isListed ? "listed" : "unlisted"
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

    await Product.findByIdAndUpdate(id, { isDeleted: true, isListed: true });

    await Cart.updateMany({}, { $pull: { items: { productId: id } } });
    await Wishlist.updateMany({}, { $pull: { items: { productId: id } } });

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

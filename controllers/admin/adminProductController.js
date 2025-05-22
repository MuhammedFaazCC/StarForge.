const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const productsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments();
    const products = await Product.find().skip(skip).limit(limit);
    const totalPages = Math.ceil(totalProducts / limit);
    let message = req.session.message;
    req.session.message = null;

    res.render('products', {
      products,
      currentPage: page,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      message 
    });
  } catch (err) {
    console.error("Error loading products page:", err);
    res.render('products', { 
      products: [], 
      currentPage: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: 1,
      nextPage: 1,
      message: { 
        success: false, 
        text: 'Error loading products. Please try again.' 
      }
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
        text: "Error loading categories. Please refresh and try again." 
      },
      categories: [],
    });
  }
};

const productAdd = async (req, res) => {
  try {
    const {
      name,
      brand,
      price,
      offer,
      description,
      category,
      sizes,
      rimMaterial,
      finish,
      stock,
      additionalInfo
    } = req.body;

    const productSizes = sizes
      ? sizes.split(",").map((size) => size.trim())
      : [];
    const additionalInfoList = additionalInfo
      ? additionalInfo.split(",").map((info) => info.trim())
      : [];

    const mainImage = req.files?.mainImage?.[0]?.filename || '';
    const additionalImages = req.files?.additionalImages
      ? req.files.additionalImages.map(file => file.filename)
      : [];

    // Validate required fields
    if (!name || !brand || !price || !category || !stock) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("addProducts", {
        message: { 
          success: false, 
          text: "Please fill in all required fields (Name, Brand, Price, Category, Stock)" 
        },
        categories,
      });
    }

    // Validate price and stock are positive numbers
    if (parseFloat(price) <= 0) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("addProducts", {
        message: { 
          success: false, 
          text: "Price must be a positive number" 
        },
        categories,
      });
    }

    if (parseInt(stock) < 0) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("addProducts", {
        message: { 
          success: false, 
          text: "Stock cannot be negative" 
        },
        categories,
      });
    }

    const newProduct = new Product({
      name: name.trim(),
      brand: brand.trim(),
      price: parseFloat(price),
      offer: offer ? parseFloat(offer) : 0,
      description: description?.trim() || '',
      category,
      sizes: productSizes,
      rimMaterial: rimMaterial?.trim() || '',
      finish: finish?.trim() || '',
      stock: parseInt(stock),
      additionalInfo: additionalInfoList,
      mainImage,
      additionalImages,
    });

    await newProduct.save();

    req.session.message = {
      success: true,
      text: `Product "${name}" has been added successfully!`
    };

    res.redirect("/admin/products");

  } catch (err) {
    console.error("Error adding product:", err);
    const categories = await Category.find({ isActive: true }).lean();
    
    let errorMessage = "Failed to add product. Please try again.";
    if (err.code === 11000) {
      errorMessage = "A product with this name already exists.";
    } else if (err.name === 'ValidationError') {
      errorMessage = "Please check your input data and try again.";
    }

    res.render("addProducts", {
      message: { 
        success: false, 
        text: errorMessage 
      },
      categories,
    });
  }
};

const viewProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product) {
      req.session.message = {
        success: false,
        text: "Product not found"
      };
      return res.redirect("/admin/products");
    }
    res.render("viewProduct", { product });
  } catch (error) {
    console.error("Error loading product view page:", error);
    req.session.message = {
      success: false,
      text: "Error loading product details"
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
        text: "Invalid product ID"
      };
      return res.redirect("/admin/products");
    }

    const product = await Product.findById(productId).lean();
    const categories = await Category.find({ isActive: true }).lean();

    if (!product) {
      req.session.message = {
        success: false,
        text: "Product not found"
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
      text: "Error loading product for editing"
    };
    res.redirect("/admin/products");
  }
};

const productEdit = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      req.session.message = {
        success: false,
        text: "Invalid product ID"
      };
      return res.redirect("/admin/products");
    }

    const {
      name,
      brand,
      price,
      offer,
      description,
      category,
      sizes,
      rimMaterial,
      finish,
      stock,
      additionalInfo
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      req.session.message = {
        success: false,
        text: "Product not found"
      };
      return res.redirect("/admin/products");
    }

    // Validate required fields
    if (!name || !brand || !price || !category || stock === undefined) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("editProduct", {
        product: product.toObject(),
        categories,
        message: { 
          success: false, 
          text: "Please fill in all required fields" 
        },
      });
    }

    // Validate price and stock
    if (parseFloat(price) <= 0) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("editProduct", {
        product: product.toObject(),
        categories,
        message: { 
          success: false, 
          text: "Price must be a positive number" 
        },
      });
    }

    if (parseInt(stock) < 0) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("editProduct", {
        product: product.toObject(),
        categories,
        message: { 
          success: false, 
          text: "Stock cannot be negative" 
        },
      });
    }

    // Update product fields
    product.name = name.trim();
    product.brand = brand.trim();
    product.price = parseFloat(price);
    product.offer = offer ? parseFloat(offer) : 0;
    product.description = description?.trim() || '';
    product.category = category;
    product.sizes = sizes ? sizes.split(",").map((s) => s.trim()) : [];
    product.rimMaterial = rimMaterial?.trim() || '';
    product.finish = finish?.trim() || '';
    product.stock = parseInt(stock);
    product.additionalInfo = additionalInfo 
      ? additionalInfo.split(",").map((info) => info.trim()) 
      : [];

    // Update images only if new files are uploaded
    if (req.files) {
      if (req.files.mainImage?.[0]) {
        product.mainImage = req.files.mainImage[0].filename;
      }
      if (req.files.additionalImages?.length > 0) {
        product.additionalImages = req.files.additionalImages.map(file => file.filename);
      }
    }

    await product.save();

    req.session.message = {
      success: true,
      text: `Product "${name}" has been updated successfully!`
    };
    
    res.redirect("/admin/products");

  } catch (err) {
    console.error("Error updating product:", err);
    
    let errorMessage = "Failed to update product. Please try again.";
    if (err.code === 11000) {
      errorMessage = "A product with this name already exists.";
    } else if (err.name === 'ValidationError') {
      errorMessage = "Please check your input data and try again.";
    }

    try {
      const product = await Product.findById(req.params.id).lean();
      const categories = await Category.find({ isActive: true }).lean();
      res.render("editProduct", {
        product,
        categories,
        message: { 
          success: false, 
          text: errorMessage 
        },
      });
    } catch (renderErr) {
      console.error("Error rendering edit page after update failure:", renderErr);
      req.session.message = {
        success: false,
        text: errorMessage
      };
      res.redirect("/admin/products");
    }
  }
};

const softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid product ID" 
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    await Product.findByIdAndUpdate(id, { isListed: false });
    
    res.status(200).json({ 
      success: true, 
      message: `Product "${product.name}" has been deleted successfully` 
    });

  } catch (error) {
    console.error("Error soft deleting product:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete product. Please try again." 
    });
  }
};

// Additional utility function for better error handling
const handleDatabaseError = (err) => {
  if (err.code === 11000) {
    return "Duplicate entry found. Please use different values.";
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return `Validation failed: ${errors.join(', ')}`;
  }
  if (err.name === 'CastError') {
    return "Invalid data format provided.";
  }
  return "An unexpected error occurred. Please try again.";
};

module.exports = {
  productsPage,
  addProduct,
  productAdd,
  viewProduct,
  editProduct,
  productEdit,
  softDeleteProduct,
};
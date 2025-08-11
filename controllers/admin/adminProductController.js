const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const productsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments({ isDeleted: false});
    const products = await Product.find({ isDeleted: false }).populate("category").sort({ _id: -1 }).skip(skip).limit(limit);
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

    const productSizes = sizes ? sizes.split(",").map((size) => size.trim()) : [];
    const additionalInfoList = additionalInfo ? additionalInfo.split(",").map((info) => info.trim()) : [];

    const basePath = '/images/';

    const mainImage = req.files?.mainImage?.[0] ? basePath + req.files.mainImage[0].filename : '';
    const additionalImages = req.files?.additionalImages ? req.files.additionalImages.map(file => basePath + file.filename) : [];

    if (!name || !brand || !price || !category || !stock) {
      const error = "Please fill in all required fields (Name, Brand, Price, Category, Stock)";
      return res.status(400).json({ success: false, message: error });
    }

    if (parseFloat(price) <= 0) {
      return res.status(400).json({ success: false, message: "Price must be a positive number" });
    }

    if (parseInt(stock) < 0) {
      return res.status(400).json({ success: false, message: "Stock cannot be negative" });
    }

    const parsedPrice = parseFloat(price);
    const parsedOffer = offer ? parseFloat(offer) : 0;
    const salesPrice = parsedOffer > 0 
      ? parsedPrice - (parsedPrice * parsedOffer / 100)
      : parsedPrice;

    const newProduct = new Product({
      name: name.trim(),
      brand: brand.trim(),
      price: parsedPrice,
      offer: parsedOffer,
      salesPrice: parseFloat(salesPrice.toFixed(2)),
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

    return res.status(200).json({
      success: true,
      message: `Product "${name}" has been added successfully!`
    });

  } catch (err) {
    console.error("Error adding product:", err);
    let errorMessage = "Failed to add product. Please try again.";
    if (err.code === 11000) {
      errorMessage = "A product with this name already exists.";
    } else if (err.name === 'ValidationError') {
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
      stock,
      sizes,
      rimMaterial,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      req.session.message = {
        success: false,
        text: "Product not found"
      };
      return res.redirect("/admin/products");
    }

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

    const parsedPrice = parseFloat(price);
    const parsedOffer = offer ? parseFloat(offer) : 0;
    const salesPrice = parsedOffer > 0 
      ? parsedPrice - (parsedPrice * parsedOffer / 100)
      : parsedPrice;

    product.name = name.trim();
    product.brand = brand.trim();
    product.price = parsedPrice;
    product.offer = parsedOffer;
    product.description = description?.trim() || '';
    product.category = category;
    product.stock = parseInt(stock);
    product.sizes = sizes ? sizes.split(",").map((s) => s.trim()) : [];
    product.rimMaterial = rimMaterial?.trim() || '';
    product.salesPrice = parseFloat(salesPrice.toFixed(2));

    const basePath = '/images/';

    if (req.files) {
      if (req.files.mainImage?.[0]) {
        product.mainImage = basePath + req.files.mainImage[0].filename;
      }
      if (req.files.additionalImages?.length > 0) {
        product.additionalImages = basePath + req.files.additionalImages.map(file => file.filename);
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

const toggleListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { isListed } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { isListed: !!isListed },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: `Product is now ${updatedProduct.isListed ? 'listed' : 'unlisted'}`,
      isListed: updatedProduct.isListed,
    });

  } catch (err) {
    console.error("Error toggling product listing:", err);
    res.status(500).json({ message: "Server error" });
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

module.exports = {
  productsPage,
  addProduct,
  productAdd,
  viewProduct,
  editProduct,
  productEdit,
  toggleListing,
  softDeleteProduct,
};
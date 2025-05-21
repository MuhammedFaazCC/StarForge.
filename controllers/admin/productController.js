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
    let message = req.session.message
    req.session.message = null


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
    console.error(err);
    res.render('products', { products: [], error: 'Error loading products' });
  }
};

const addProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    return res.render("addProducts", { message: null, categories });
  } catch (err) {
    console.error("Error loading add product page:", err);
    res.render("addProducts", {
      message: { type: "error", text: "Error loading categories" },
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
      boltPattern,
      hubBore,
      offset,
      color,
      loadRating,
      additionalInfo,
    } = req.body;

    const productSizes = sizes
      ? sizes.split(",").map((size) => size.trim())
      : [];
    const additionalInfoList = additionalInfo
      ? additionalInfo.split(",").map((info) => info.trim())
      : [];

    // Handle file uploads
    const mainImage = req.files?.mainImage?.[0]?.filename || '';
    const additionalImages = req.files?.additionalImages
      ? req.files.additionalImages.map(file => file.filename)
      : [];

    // Validate required fields
    if (!name || !brand || !price || !category || !stock) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("addProducts", {
        message: { type: "error", text: "Required fields are missing" },
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
      specifications: {
        boltPattern: boltPattern?.trim() || '',
        hubBore: hubBore?.trim() || '',
        offset: offset?.trim() || '',
        color: color?.trim() || '',
        loadRating: loadRating?.trim() || '',
        additionalInfo: additionalInfoList,
      },
      mainImage,
      additionalImages,
    });

    await newProduct.save();

    const categories = await Category.find({ isActive: true }).lean();
    res.render("products", {
      products: await Product.find({}).lean(),
      categories,
      message: { type: "success", text: "Product added successfully" },
    });
  } catch (err) {
    console.error("Error adding product:", err);
    const categories = await Category.find({ isActive: true }).lean();
    res.render("addProducts", {
      message: { type: "error", text: err.message || "Failed to add product" },
      categories,
    });
  }
};

const viewProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product) {
      return res.status(404).send("Product not found");
    }
    res.render("viewProduct", { product });
  } catch (error) {
    console.error("Error loading product view page:", error);
    res.status(500).send("Internal Server Error");
  }
};

// const paginatio

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).lean();
    const categories = await Category.find({ isActive: true }).lean();

    if (!product) {
      return res
        .status(404)
        .render("admin/404", { message: "Product not found" });
    }

    res.render("editProduct", {
      product,
      categories,
      message: null,
    });
  } catch (err) {
    console.error("Error loading product edit page:", err);
    res.status(500).render("admin/500", { message: "Internal server error" });
  }
};

const   productEdit = async (req, res) => {
  try {
    const productId = req.params.id;
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
      boltPattern,
      hubBore,
      offset,
      color,
      loadRating,
      additionalInfo,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .render("admin/404", { message: "Product not found" });
    }

    // Validate required fields
    if (!name || !brand || !price || !category || !stock) {
      const categories = await Category.find({ isActive: true }).lean();
      return res.render("editProduct", {
        product,
        categories,
        message: { type: "error", text: "Required fields are missing" },
      });
    }

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
    product.specifications = {
      boltPattern: boltPattern?.trim() || '',
      hubBore: hubBore?.trim() || '',
      offset: offset?.trim() || '',
      color: color?.trim() || '',
      loadRating: loadRating?.trim() || '',
      additionalInfo: additionalInfo
        ? additionalInfo.split(",").map((i) => i.trim())
        : [],
    };

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

    const categories = await Category.find({ isActive: true }).lean();
    req.session.message = {success:true,text: "Product updated successfully"};
    res.redirect("/admin/products");

  } catch (err) {
    console.error("Error updating product:", err);
    const product = await Product.findById(req.params.id).lean();
    const categories = await Category.find({ isActive: true }).lean();
    res.render("editProduct", {
      product,
      categories,
      message: {success:false, text: err.message || "Failed to update product" },
    });
  }
};

const softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: false });
    res.status(200).json({ message: "Product soft deleted." });
  } catch (error) {
    console.error("Error soft deleting product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  productsPage,
  addProduct,
  productAdd,
  viewProduct,
  // pagination,
  editProduct,
  productEdit,
  softDeleteProduct,
};
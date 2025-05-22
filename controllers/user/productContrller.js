const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const getAllProduct = async (req, res) => {
  try {
    // Get user data if logged in
    const user = req.session.user;
    const userData = user ? await User.findOne({ _id: user }) : null;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 9; // Products per page
    const skip = (page - 1) * limit;
    
    // Build filter query
    const filterQuery = { isListed: true };
    
    // Category filter
    if (req.query.category && req.query.category !== 'all') {
      const category = await Category.findOne({ name: req.query.category });
      if (category) {
        filterQuery.category = category._id;
      }
    }
    
    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filterQuery.price = {};
      if (req.query.minPrice) {
        filterQuery.price.$gte = parseInt(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        filterQuery.price.$lte = parseInt(req.query.maxPrice);
      }
    }
    
    // Search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { description: searchRegex }
      ];
    }
    
    // Determine sort order
    let sortOption = { createdAt: -1 }; // Default: latest
    
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price-low-high':
          sortOption = { price: 1 };
          break;
        case 'price-high-low':
          sortOption = { price: -1 };
          break;
        case 'popular':
          sortOption = { salesCount: -1 }; // Assuming you have a salesCount field
          break;
        default:
          sortOption = { createdAt: -1 };
      }
    }
    
    // Execute query with pagination
    const products = await Product.find(filterQuery)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .lean();
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalProducts / limit);
    
    // Format products for display
    const formattedProducts = products.map(product => {
      // Calculate discounted price if offer exists
      let salePrice = product.price;
      if (product.offer > 0) {
        salePrice = product.price * (1 - product.offer / 100);
      }
      
      return {
        _id: product._id,
        name: product.name,
        brand: product.brand,
        mainImage: product.mainImage,
        regularPrice: product.price,
        salePrice: Math.floor(salePrice),
        offer: product.offer || 0,
        stock: product.stock,
        category: product.category
      };
    });
    
    // Get categories for filtering
    const categories = await Category.find().lean();
    
    // Determine price range for filter
    const priceStats = await Product.aggregate([
      { $match: { isListed: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" }
        }
      }
    ]);
    
    const priceRange = {
      min: priceStats.length > 0 ? Math.floor(priceStats[0].minPrice) : 0,
      max: priceStats.length > 0 ? Math.ceil(priceStats[0].maxPrice) : 5000
    };
    
    // Get filters from query params
    const filters = {
      category: req.query.category || 'all',
      minPrice: parseInt(req.query.minPrice) || priceRange.min,
      maxPrice: parseInt(req.query.maxPrice) || priceRange.max,
      sort: req.query.sort || 'latest',
      search: req.query.search || ''
    };
    
    // Render the product page
    res.render("allproduct", {
      user: userData,
      products: formattedProducts,
      totalProducts,
      currentPage: page,
      totalPages,
      filters: filters,
      priceRange: priceRange,
      categories: categories
    });
  } catch (error) {
    console.error("Error loading all products page:", error);
    res.status(500).render("page-404", {
      message: "Failed to load products. Please try again later."
    });
  }
};

// Get single product details
const getProductDetails = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = user ? await User.findOne({ _id: user }) : null;
    
    const productId = req.params.id;
    const product = await Product.findById(productId).populate('category').lean();
    
    if (!product || !product.isListed) {
      return res.status(404).render("page-404", { 
        message: "Product not found"
      });
    }
    
    // Calculate discounted price if offer exists
    let salePrice = product.price;
    if (product.offer > 0) {
      salePrice = product.price * (1 - product.offer / 100);
    }
    
    const formattedProduct = {
      ...product,
      salePrice: Math.floor(salePrice)
    };
    
    // Get related products from same category
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isListed: true
    })
    .limit(4)
    .lean()
    .map(p => {
      let relatedSalePrice = p.price;
      if (p.offer > 0) {
        relatedSalePrice = p.price * (1 - p.offer / 100);
      }
      return {
        ...p,
        salePrice: Math.floor(relatedSalePrice)
      };
    });
    
    res.render("productDetails", {
      user: userData,
      product: formattedProduct,
      relatedProducts: relatedProducts
    });
  } catch (error) {
    console.error("Error loading product details:", error);
    res.status(500).render("page-404", {
      message: "Failed to load product details. Please try again later."
    });
  }
};

module.exports = {
  getAllProduct,
  getProductDetails
};
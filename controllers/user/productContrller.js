const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Review = require('../../models/reviewSchema');
const Wishlist = require('../../models/wishlistSchema')

const getAllProduct = async (req, res) => {
  try {
    console.log('Incoming Request:', {
      url: req.originalUrl,
      query: req.query,
      method: req.method
    });

    const user = req.session.user;
    const userData = user ? await User.findOne({ _id: user }) : null;
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 9;
    const skip = (page - 1) * limit;
    
    const filterQuery = { isListed: true };
    
    if (req.query.category && req.query.category !== 'all') {
      const category = await Category.findOne({ name: req.query.category });
      if (category) {
        filterQuery.category = category._id;
      } else {
        console.log(`Category not found: ${req.query.category}`);
      }
    }
    
    if (req.query.minPrice || req.query.maxPrice) {
      filterQuery.price = {};
      const minPrice = parseInt(req.query.minPrice);
      const maxPrice = parseInt(req.query.maxPrice);
      if (!isNaN(minPrice) && minPrice >= 0) {
        filterQuery.price.$gte = minPrice;
      }
      if (!isNaN(maxPrice) && maxPrice >= 0) {
        filterQuery.price.$lte = maxPrice;
      }
      if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > maxPrice) {
        filterQuery.price.$gte = maxPrice;
        filterQuery.price.$lte = minPrice;
        console.log('Swapped minPrice and maxPrice:', { minPrice, maxPrice });
      }
    }
    
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      if (searchTerm) {
        const searchRegex = new RegExp(searchTerm, 'i');
        filterQuery.$or = [
          { name: searchRegex },
          { brand: searchRegex },
          { description: searchRegex }
        ];
      }
    }
    
    let sortOption = { createdAt: -1 };
    
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price-low-high':
          sortOption = { price: 1 };
          break;
        case 'price-high-low':
          sortOption = { price: -1 };
          break;
        case 'name-asc':
          sortOption = { name: 1 };
          break;
        case 'name-desc':
          sortOption = { name: -1 };
          break;
        case 'popular':
          sortOption = { salesCount: -1, createdAt: -1 };
          console.log('Warning: salesCount field missing, using createdAt as fallback for popular sort');
          break;
        default:
          sortOption = { createdAt: -1 };
      }
    }
    
    console.log('Pagination Debug:', {
      page,
      skip,
      limit,
      filterQuery,
      sortOption,
      queryParams: req.query
    });
    
    const startTime = Date.now();
    const products = await Product.find(filterQuery)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .lean();
    const queryTime = Date.now() - startTime;
    
    console.log('Products Fetched:', {
      count: products.length,
      products: products.map(p => ({ _id: p._id, name: p.name, category: p.category?.name })),
      queryTime: `${queryTime}ms`
    });
    
    const totalProducts = await Product.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalProducts / limit);
    
    console.log('Pagination Summary:', { totalProducts, totalPages });
    
    if (page > totalPages && totalPages > 0) {
      console.log(`Redirecting: Page ${page} exceeds totalPages ${totalPages}`);
      const redirectUrl = buildUrl({ page: totalPages });
      return res.redirect(redirectUrl);
    }
    
    const formattedProducts = products.map(product => {
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
    
    const categories = await Category.find().lean();
    
    console.log('Available Categories:', categories.map(c => c.name));
    
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
    
    const filters = {
      category: req.query.category || 'all',
      minPrice: parseInt(req.query.minPrice) || priceRange.min,
      maxPrice: parseInt(req.query.maxPrice) || priceRange.max,
      sort: req.query.sort || 'latest',
      search: req.query.search || ''
    };
    
    const buildUrl = (params = {}) => {
      const currentParams = {
        category: req.query.category || 'all',
        minPrice: req.query.minPrice || priceRange.min,
        maxPrice: req.query.maxPrice || priceRange.max,
        sort: req.query.sort || 'latest',
        search: req.query.search || '',
        page: req.query.page || '1'
      };
      
      const finalParams = { ...currentParams, ...params };
      
      const queryParts = [];
      if (finalParams.category !== 'all') {
        queryParts.push(`category=${encodeURIComponent(finalParams.category)}`);
      }
      if (parseInt(finalParams.minPrice) > priceRange.min) {
        queryParts.push(`minPrice=${finalParams.minPrice}`);
      }
      if (parseInt(finalParams.maxPrice) < priceRange.max) {
        queryParts.push(`maxPrice=${finalParams.maxPrice}`);
      }
      if (finalParams.sort !== 'latest') {
        queryParts.push(`sort=${finalParams.sort}`);
      }
      if (finalParams.search) {
        queryParts.push(`search=${encodeURIComponent(finalParams.search)}`);
      }
      if (finalParams.page !== '1') {
        queryParts.push(`page=${finalParams.page}`);
      }
      
      const url = queryParts.length > 0 ? `/allproduct?${queryParts.join('&')}` : '/allproduct';
      console.log('Generated buildUrl:', url);
      return url;
    };
    
    const productSchemaFields = await Product.findOne().lean();
    console.log('Product Schema Fields:', Object.keys(productSchemaFields || {}));

     const wishlist = await Wishlist.findOne({ userId : user._id }).populate('items.productId');
      wishlistItems = wishlist ? wishlist.items : [];
    
    res.render("allproduct", {
    
      user: userData,
      products: formattedProducts,
      totalProducts,
      currentPage: page,
      totalPages,
      filters: filters,
      priceRange: priceRange,
      userWishlistItems: wishlistItems,
      categories: categories,
      buildUrl,
      noProductsMessage: products.length === 0 && totalProducts > 0 
        ? `No products found on page ${page}. Try adjusting your filters or navigating to a different page.` 
        : products.length === 0 && totalProducts === 0 
        ? `No products available. Please check back later.` 
        : null
    });
  } catch (error) {
    console.error("Error loading all products page:", error);
    try {
      res.status(500).render("error", {
        message: "Failed to load products. Please try again later."
      });
    } catch (viewError) {
      res.status(500).send("Internal Server Error: Failed to load products.");
    }
  }
};

const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const user = req.session.user;
    const userData = user ? await User.findById(user) : null;

    const product = await Product.findById(productId)
      .populate('category')
      .lean();

    if (!product || !product.isListed) {
      return res.status(404).render("page-404", { message: "Product not found" });
    }

    let salePrice = product.price;
    if (product.offer > 0) {
      salePrice = product.price * (1 - product.offer / 100);
    }

    const reviews = await Review.find({ product: productId }).populate('user').sort({ createdAt: -1 }).lean();

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isListed: true
    }).limit(4).lean();



    res.render('productDetails', {
      user: userData,
      product: { ...product, salePrice: Math.floor(salePrice) },
      relatedProducts,
      reviews,
    });
  } catch (err) {
    console.error("getProductDetails error:", err);
    res.status(500).render("pageNotFound", { message: "Failed to load product details." });
  }
};

const postReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.id;
    const userId = req.session.user;

    if (!userId) {
      req.session.error = "Please login to submit a review";
      return res.redirect(`/product/${productId}`);
    }

    await Review.create({
      product: productId,
      user: userId,
      rating,
      comment
    });

    res.redirect(`/product/${productId}`);
  } catch (err) {
    console.error("postReview error:", err);
    res.status(500).redirect(`/product/${req.params.id}`);
  }
};

module.exports = {
  getAllProduct,
  getProductDetails,
  postReview,
};
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Review = require('../../models/reviewSchema');
const Wishlist = require('../../models/wishlistSchema')

  const getAllProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = user ? await User.findOne({ _id: user._id }) : null;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 9;
    const skip = (page - 1) * limit;

    const filterQuery = { isListed: true };

    const categoryParam = req.query.category || 'all';
    if (categoryParam !== 'all') {
      const categoryDoc = await Category.findOne({ name: categoryParam });
      if (categoryDoc) {
        filterQuery.category = categoryDoc._id;
      }
    }

    const priceStats = await Product.aggregate([
      { $match: { isListed: true } },
      {
        $addFields: {
          salePrice: {
            $cond: {
              if: { $gt: ["$offer", 0] },
              then: {
                $multiply: [
                  "$price",
                  { $subtract: [1, { $divide: ["$offer", 100] }] }
                ]
              },
              else: "$price"
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$salePrice" },
          maxPrice: { $max: "$salePrice" }
        }
      }
    ]);

    const priceRange = {
      min: priceStats.length > 0 ? Math.floor(priceStats[0].minPrice) : 0,
      max: priceStats.length > 0 ? Math.ceil(priceStats[0].maxPrice) : 5000
    };

    const minPrice = parseInt(req.query.minPrice);
    const maxPrice = parseInt(req.query.maxPrice);
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      const salePriceFilter = {};
      if (!isNaN(minPrice)) salePriceFilter.$gte = minPrice;
      if (!isNaN(maxPrice)) salePriceFilter.$lte = maxPrice;
      if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > maxPrice) {
        salePriceFilter.$gte = maxPrice;
        salePriceFilter.$lte = minPrice;
      }

      filterQuery.$expr = {
        $and: [
          {
            $gte: [
              {
                $cond: {
                  if: { $gt: ["$offer", 0] },
                  then: {
                    $multiply: [
                      "$price",
                      { $subtract: [1, { $divide: ["$offer", 100] }] }
                    ]
                  },
                  else: "$price"
                }
              },
              salePriceFilter.$gte || 0
            ]
          },
          {
            $lte: [
              {
                $cond: {
                  if: { $gt: ["$offer", 0] },
                  then: {
                    $multiply: [
                      "$price",
                      { $subtract: [1, { $divide: ["$offer", 100] }] }
                    ]
                  },
                  else: "$price"
                }
              },
              salePriceFilter.$lte || 999999
            ]
          }
        ]
      };
    }

    const searchTerm = req.query.search?.trim();
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { description: searchRegex }
      ];
    }

    let sortOption = { createdAt: -1 };
    switch (req.query.sort) {
      case 'price-low-high':
        sortOption = [
          {
            $addFields: {
              salePrice: {
                $cond: {
                  if: { $gt: ["$offer", 0] },
                  then: {
                    $multiply: [
                      "$price",
                      { $subtract: [1, { $divide: ["$offer", 100] }] }
                    ]
                  },
                  else: "$price"
                }
              }
            }
          },
          { $sort: { salePrice: 1 } }
        ];
        break;
      case 'price-high-low':
        sortOption = [
          {
            $addFields: {
              salePrice: {
                $cond: {
                  if: { $gt: ["$offer", 0] },
                  then: {
                    $multiply: [
                      "$price",
                      { $subtract: [1, { $divide: ["$offer", 100] }] }
                    ]
                  },
                  else: "$price"
                }
              }
            }
          },
          { $sort: { salePrice: -1 } }
        ];
        break;
      case 'name-asc':
        sortOption = { name: 1 };
        break;
      case 'name-desc':
        sortOption = { name: -1 };
        break;
      case 'popular':
        sortOption = { salesCount: -1, createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    let pipeline = [
      { $match: filterQuery }
    ];

    if (Array.isArray(sortOption)) {
      pipeline = pipeline.concat(sortOption);
    } else {
      pipeline.push({ $sort: sortOption });
    }

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category'
      }
    });

    pipeline.push({
      $match: {
        'category.0': { $exists: true }
      }
    });

    pipeline.push({
      $unwind: '$category'
    });

    const [products, totalProducts, categories, wishlist] = await Promise.all([
      Product.aggregate(pipeline),
      Product.countDocuments(filterQuery),
      Category.find().lean(),
      Wishlist.findOne({ userId: user?._id }).populate('items.productId')
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    const formattedProducts = products.map(product => {
      const salePrice = product.offer > 0 ? product.price * (1 - product.offer / 100) : product.price;
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

    const filters = {
      category: categoryParam,
      minPrice: !isNaN(minPrice) ? minPrice : priceRange.min,
      maxPrice: !isNaN(maxPrice) ? maxPrice : priceRange.max,
      sort: req.query.sort || 'latest',
      search: searchTerm || ''
    };

    const buildUrl = (params = {}) => {
      const currentParams = {
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sort: filters.sort,
        search: filters.search,
        page: req.query.page || '1'
      };

      const finalParams = { ...currentParams, ...params };
      const queryParts = [];

      if (finalParams.category !== 'all') queryParts.push(`category=${encodeURIComponent(finalParams.category)}`);
      if (parseInt(finalParams.minPrice) > priceRange.min) queryParts.push(`minPrice=${finalParams.minPrice}`);
      if (parseInt(finalParams.maxPrice) < priceRange.max) queryParts.push(`maxPrice=${finalParams.maxPrice}`);
      if (finalParams.sort !== 'latest') queryParts.push(`sort=${finalParams.sort}`);
      if (finalParams.search) queryParts.push(`search=${encodeURIComponent(finalParams.search)}`);
      if (finalParams.page !== '1') queryParts.push(`page=${finalParams.page}`);

      return queryParts.length > 0 ? `/products?${queryParts.join('&')}` : '/products';
    };

    const wishlistItems = wishlist ? wishlist.items : [];

    const initialFilters = {
      minPrice: priceRange.min,
      maxPrice: priceRange.max
    };

    res.render("allproduct", {
      user: userData,
      products: formattedProducts,
      totalProducts,
      currentPage: page,
      totalPages,
      filters,
      priceRange,
      userWishlistItems: wishlistItems,
      categories,
      buildUrl,
      initialFilters,
      noProductsMessage:
        formattedProducts.length === 0 && totalProducts > 0
          ? `No products found on page ${page}. Try adjusting your filters or navigating to a different page.`
          : formattedProducts.length === 0 && totalProducts === 0
          ? `No products available. Please check back later.`
          : null
    });
  } catch (error) {
    console.error("Error loading all products page:", error);
    res.status(500).render("error", {
      message: "Failed to load products. Please try again later."
    });
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
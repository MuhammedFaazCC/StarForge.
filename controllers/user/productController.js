const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Review = require("../../models/reviewSchema");
const Wishlist = require("../../models/wishlistSchema");

const escapeRegex = (str = "") =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAllProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = user ? await User.findById(user._id).lean() : null;

    /* ---------------- pagination ---------------- */
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 9;
    const skip = (page - 1) * limit;

    /* ---------------- query params ---------------- */
    const categoryParam = req.query.category || "all";
    const minPrice = !isNaN(parseInt(req.query.minPrice)) ? parseInt(req.query.minPrice) : null;
    const maxPrice = !isNaN(parseInt(req.query.maxPrice)) ? parseInt(req.query.maxPrice) : null;
    const sortParam = req.query.sort || "latest";
    const searchTerm = req.query.search?.trim() || "";

    /* ---------------- sale price expression (SINGLE SOURCE OF TRUTH) ---------------- */
    const salePriceExpr = {
      $cond: {
        if: { $gt: [{ $max: ["$offer", "$categoryOffer"] }, 0] },
        then: {
          $multiply: [
            "$price",
            {
              $subtract: [
                1,
                { $divide: [{ $max: ["$offer", "$categoryOffer"] }, 100] }
              ]
            }
          ]
        },
        else: "$price"
      }
    };

    /* ---------------- base pipeline ---------------- */
    const pipelineBase = [
      { $match: { isListed: true } },
      { $addFields: { salePrice: salePriceExpr } }
    ];

    /* ---------------- category filter ---------------- */
    let invalidCategory = false;

    if (categoryParam !== "all") {
      const categoryDoc = await Category.findOne({ name: categoryParam }).lean();
      if (categoryDoc) {
        pipelineBase.push({ $match: { category: categoryDoc._id } });
      } else {
        invalidCategory = true;
      }
    }

    /* ---------------- price filter ---------------- */
    if (minPrice !== null || maxPrice !== null) {
      pipelineBase.push({
        $match: {
          salePrice: {
            ...(minPrice !== null && { $gte: minPrice }),
            ...(maxPrice !== null && { $lte: maxPrice })
          }
        }
      });
    }

    /* ---------------- search filter ---------------- */
    if (searchTerm) {
      const safeSearch = escapeRegex(searchTerm.slice(0, 50));
      pipelineBase.push({
        $match: {
          $or: [
            { name: { $regex: safeSearch, $options: "i" } },
            { brand: { $regex: safeSearch, $options: "i" } },
            { description: { $regex: safeSearch, $options: "i" } }
          ]
        }
      });
    }

    /* ---------------- sorting ---------------- */
    const sortMap = {
      "price-low-high": { salePrice: 1 },
      "price-high-low": { salePrice: -1 },
      "name-asc": { name: 1 },
      "name-desc": { name: -1 },
      "popular": { salesCount: -1, createdAt: -1 },
      "latest": { createdAt: -1 }
    };

    pipelineBase.push({
      $sort: sortMap[sortParam] || sortMap.latest
    });

    /* ---------------- COUNT (uses SAME pipeline) ---------------- */
    const countPipeline = [...pipelineBase, { $count: "total" }];
    const countResult = await Product.aggregate(countPipeline);
    const totalProducts = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalProducts / limit);
    
    if (page > totalPages && totalPages > 0) {
      return res.redirect(`/products?page=${totalPages}`);
    }

    /* ---------------- pagination ---------------- */
    pipelineBase.push(
      { $skip: skip },
      { $limit: limit }
    );

    /* ---------------- category lookup ---------------- */
    pipelineBase.push(
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" }
    );

    /* ---------------- execute ---------------- */
    const products = await Product.aggregate(pipelineBase);

    /* ---------------- format for UI ---------------- */
    const formattedProducts = products.map(p => ({
      _id: p._id,
      name: p.name,
      brand: p.brand,
      mainImage: p.mainImage,
      regularPrice: p.price,
      salePrice: Math.floor(p.salePrice),
      offer: Math.max(p.offer || 0, p.categoryOffer || 0),
      stock: p.stock,
      category: p.category
    }));

    /* ---------------- wishlist ---------------- */
    const wishlist = user
      ? await Wishlist.findOne({ userId: user._id }).populate("items.productId")
      : null;

    const wishlistItems = wishlist ? wishlist.items : [];

    /* ---------------- price range (global) ---------------- */
    const priceStats = await Product.aggregate([
      { $match: { isListed: true } },
      { $addFields: { salePrice: salePriceExpr } },
      {
        $group: {
          _id: null,
          min: { $min: "$salePrice" },
          max: { $max: "$salePrice" }
        }
      }
    ]);

    const priceRange = {
      min: priceStats[0]?.min ? Math.floor(priceStats[0].min) : 0,
      max: priceStats[0]?.max ? Math.ceil(priceStats[0].max) : 5000
    };

    /* ---------------- filters object ---------------- */
    const filters = {
      category: categoryParam,
      minPrice: minPrice ?? priceRange.min,
      maxPrice: maxPrice ?? priceRange.max,
      sort: sortParam,
      search: searchTerm
    };

    /* ---------------- buildUrl (used by EJS pagination) ---------------- */
    const buildUrl = (params = {}) => {
      const final = { ...filters, page, ...params };
      const q = [];

      if (final.category !== "all") q.push(`category=${encodeURIComponent(final.category)}`);
      if (final.minPrice > priceRange.min) q.push(`minPrice=${final.minPrice}`);
      if (final.maxPrice < priceRange.max) q.push(`maxPrice=${final.maxPrice}`);
      if (final.sort !== "latest") q.push(`sort=${final.sort}`);
      if (final.search) q.push(`search=${encodeURIComponent(final.search)}`);
      if (final.page !== 1) q.push(`page=${final.page}`);

      return q.length ? `/products?${q.join("&")}` : "/products";
    };

    /* ---------------- initial filters for JS ---------------- */
    const initialFilters = {
      minPrice: priceRange.min,
      maxPrice: priceRange.max
    };

    /* ---------------- render ---------------- */
    res.render("allProduct", {
      user: userData,
      products: formattedProducts,
      totalProducts,
      currentPage: page,
      totalPages,
      filters,
      priceRange,
      userWishlistItems: wishlistItems,
      categories: await Category.find().lean(),
      buildUrl,
      initialFilters,
      noProductsMessage:
      invalidCategory
        ? "Selected category does not exist."
        : formattedProducts.length === 0 && totalProducts === 0
        ? "No products available."
        : formattedProducts.length === 0
        ? `No products found on page ${page}.`
        : null
    });

  } catch (err) {
    console.error("getAllProduct error:", err);
    res.status(500).render("error", {
      message: "Failed to load products. Please try again later."
    });
  }
};


const getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const user = req.session.user;
    const userData = user ? await User.findById(user._id) : null;

    const product = await Product.findById(productId)
      .populate("category")
      .lean();
    if (!product || !product.isListed) {
      return res
        .status(404)
        .render("page-404", { message: "Product not found" });
    }

    const effectiveOffer = Math.max(
      product.offer || 0,
      product.categoryOffer || 0
    );
    const salePrice =
      effectiveOffer > 0
        ? product.price * (1 - effectiveOffer / 100)
        : product.price;

    const reviews = await Review.find({ product: productId })
      .populate("user")
      .sort({ createdAt: -1 })
      .lean();

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isListed: true,
    })
      .limit(4)
      .lean();

    // Check wishlist membership
    let isInWishlist = false;
    if (user && user._id) {
      const wishlist = await Wishlist.findOne({ userId: user._id }, { items: 1 }).lean();
      if (wishlist && Array.isArray(wishlist.items)) {
        isInWishlist = wishlist.items.some(it => String(it.productId) === String(product._id));
      }
    }

    res.render("productDetails", {
      user: userData,
      product: { ...product, salePrice: Math.floor(salePrice) },
      relatedProducts,
      reviews,
      isInWishlist,
    });
  } catch (err) {
    console.error("getProductDetails error:", err);
    res
      .status(500)
      .render("pageNotFound", { message: "Failed to load product details." });
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
      comment,
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

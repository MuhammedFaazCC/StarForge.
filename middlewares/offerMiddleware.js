const Offer = require('../models/offerSchema');
const Product = require('../models/productSchema');
const Category = require('../models/categorySchema');

const calculateBestOffer = async (req, res, next) => {
    try {
        res.locals.calculateProductPrice = function(product) {
            const productOffer = product.offer || 0;
            const categoryOffer = product.categoryOffer || 0;
            const bestOffer = Math.max(productOffer, categoryOffer);
            
            let finalPrice = product.price;
            
            if (bestOffer > 0) {
                finalPrice = product.price - (product.price * bestOffer / 100);
            }
            
            if (product.salesPrice && product.salesPrice < finalPrice) {
                finalPrice = product.salesPrice;
            }
            
            return {
                originalPrice: product.price,
                finalPrice: Math.round(finalPrice * 100) / 100,
                discount: bestOffer,
                savings: Math.round((product.price - finalPrice) * 100) / 100,
                hasOffer: bestOffer > 0
            };
        };
        
        next();
    } catch (error) {
        console.error('Error in offer middleware:', error);
        next();
    }
};

const getActiveOffersForProduct = async (productId) => {
    try {
        const now = new Date();
        
        const product = await Product.findById(productId).populate('category');
        if (!product) return [];
        
        const productOffers = await Offer.find({
            type: 'product',
            applicableTo: productId,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { usageLimit: null },
                { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
            ]
        });
        
        const categoryOffers = await Offer.find({
            type: 'category',
            applicableTo: product.category._id,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { usageLimit: null },
                { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
            ]
        });
        
        return [...productOffers, ...categoryOffers];
    } catch (error) {
        console.error('Error getting active offers:', error);
        return [];
    }
};

const getBestOfferForProduct = async (productId, orderAmount = 0) => {
    try {
        const offers = await getActiveOffersForProduct(productId);
        
        const applicableOffers = offers.filter(offer => 
            orderAmount >= (offer.minimumAmount || 0)
        );
        
        if (applicableOffers.length === 0) return null;
        
        return applicableOffers.reduce((best, current) => 
            current.discountPercentage > best.discountPercentage ? current : best
        );
    } catch (error) {
        console.error('Error getting best offer:', error);
        return null;
    }
};

const applyOfferToPrice = (originalPrice, offerPercentage) => {
    if (!offerPercentage || offerPercentage <= 0) return originalPrice;
    
    const discount = (originalPrice * offerPercentage) / 100;
    return Math.round((originalPrice - discount) * 100) / 100;
};

const incrementOfferUsage = async (offerId) => {
    try {
        await Offer.findByIdAndUpdate(offerId, {
            $inc: { usedCount: 1 }
        });
    } catch (error) {
        console.error('Error incrementing offer usage:', error);
    }
};

const isOfferValid = (offer) => {
    const now = new Date();
    return offer.isActive && 
           offer.startDate <= now && 
           offer.endDate >= now &&
           (offer.usageLimit === null || offer.usedCount < offer.usageLimit);
};

const getActiveOffers = async () => {
    try {
        const now = new Date();
        return await Offer.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).populate('applicableTo');
    } catch (error) {
        console.error('Error getting active offers:', error);
        return [];
    }
};

const cleanupExpiredOffers = async () => {
    try {
        const now = new Date();
        
        const expiredOffers = await Offer.find({
            endDate: { $lt: now }
        });
        
        for (const offer of expiredOffers) {
            if (offer.type === 'product') {
                await Product.updateMany(
                    { _id: { $in: offer.applicableTo } },
                    { offer: 0 }
                );
            } else if (offer.type === 'category') {
                await Category.updateMany(
                    { _id: { $in: offer.applicableTo } },
                    { offer: 0 }
                );
                
                await Product.updateMany(
                    { category: { $in: offer.applicableTo } },
                    { categoryOffer: 0 }
                );
            }
        }
        
        console.log(`Cleaned up ${expiredOffers.length} expired offers`);
    } catch (error) {
        console.error('Error cleaning up expired offers:', error);
    }
};

module.exports = {
    calculateBestOffer,
    getActiveOffersForProduct,
    getBestOfferForProduct,
    applyOfferToPrice,
    incrementOfferUsage,
    isOfferValid,
    getActiveOffers,
    cleanupExpiredOffers
};
const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const getOffers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalOffers = await Offer.countDocuments();
        const totalPages = Math.ceil(totalOffers / limit);

        const offers = await Offer.find()
            .populate('applicableTo')
            .populate('createdBy', 'fullName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.render('admin/offers', {
            offers,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1
        });
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).render('admin/offers', {
            offers: [],
            error: 'Failed to load offers'
        });
    }
};

const getAddOffer = async (req, res) => {
    try {
        const products = await Product.find({ isListed: true, isDeleted: false })
            .select('name brand price')
            .sort({ name: 1 });
        
        const categories = await Category.find({ isActive: true, isDeleted: false })
            .select('name')
            .sort({ name: 1 });

        res.render('admin/addOffer', {
            products,
            categories,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error loading add offer page:', error);
        res.status(500).render('admin/addOffer', {
            products: [],
            categories: [],
            error: 'Failed to load form data'
        });
    }
};

const createOffer = async (req, res) => {
    try {
        const {
            title,
            description,
            type,
            discountPercentage,
            applicableTo,
            startDate,
            endDate,
            usageLimit,
            minimumAmount
        } = req.body;

        if (!title || !type || !discountPercentage || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }

        if (discountPercentage < 0 || discountPercentage > 100) {
            return res.status(400).json({
                success: false,
                message: 'Discount percentage must be between 0 and 100'
            });
        }

        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

        const offerData = {
            title: title.trim(),
            description: description?.trim() || '',
            type,
            discountPercentage: parseFloat(discountPercentage),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            minimumAmount: minimumAmount ? parseFloat(minimumAmount) : 0,
            createdBy: req.session.user._id
        };

        if (type === 'product' || type === 'category') {
            if (!applicableTo || applicableTo.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Please select at least one ${type} for this offer`
                });
            }
            
            offerData.applicableTo = Array.isArray(applicableTo) ? applicableTo : [applicableTo];
            offerData.applicableToModel = type === 'product' ? 'Product' : 'Category';
        }

        const offer = new Offer(offerData);
        await offer.save();

        if (type === 'product') {
            await Product.updateMany(
                { _id: { $in: offerData.applicableTo } },
                { offer: discountPercentage }
            );
        } else if (type === 'category') {
            await Category.updateMany(
                { _id: { $in: offerData.applicableTo } },
                { offer: discountPercentage }
            );
            
            await Product.updateMany(
                { category: { $in: offerData.applicableTo } },
                { categoryOffer: discountPercentage }
            );
        }

        res.json({
            success: true,
            message: 'Offer created successfully'
        });

    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create offer'
        });
    }
};

const getEditOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await Offer.findById(id).populate('applicableTo');
        
        if (!offer) {
            return res.status(404).render('admin/editOffer', {
                error: 'Offer not found'
            });
        }

        const products = await Product.find({ isListed: true, isDeleted: false })
            .select('name brand price')
            .sort({ name: 1 });
        
        const categories = await Category.find({ isActive: true, isDeleted: false })
            .select('name')
            .sort({ name: 1 });

        res.render('admin/editOffer', {
            offer,
            products,
            categories,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error loading edit offer page:', error);
        res.status(500).render('admin/editOffer', {
            error: 'Failed to load offer details'
        });
    }
};

const updateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            discountPercentage,
            startDate,
            endDate,
            usageLimit,
            minimumAmount,
            isActive
        } = req.body;

        const offer = await Offer.findById(id);
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        if (discountPercentage < 0 || discountPercentage > 100) {
            return res.status(400).json({
                success: false,
                message: 'Discount percentage must be between 0 and 100'
            });
        }

        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

        offer.title = title.trim();
        offer.description = description?.trim() || '';
        offer.discountPercentage = parseFloat(discountPercentage);
        offer.startDate = new Date(startDate);
        offer.endDate = new Date(endDate);
        offer.usageLimit = usageLimit ? parseInt(usageLimit) : null;
        offer.minimumAmount = minimumAmount ? parseFloat(minimumAmount) : 0;
        offer.isActive = isActive === 'true' || isActive === true;

        await offer.save();

        if (offer.type === 'product') {
            await Product.updateMany(
                { _id: { $in: offer.applicableTo } },
                { offer: offer.isActive ? offer.discountPercentage : 0 }
            );
        } else if (offer.type === 'category') {
            await Category.updateMany(
                { _id: { $in: offer.applicableTo } },
                { offer: offer.isActive ? offer.discountPercentage : 0 }
            );
            
            await Product.updateMany(
                { category: { $in: offer.applicableTo } },
                { categoryOffer: offer.isActive ? offer.discountPercentage : 0 }
            );
        }

        res.json({
            success: true,
            message: 'Offer updated successfully'
        });

    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update offer'
        });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await Offer.findById(id);
        
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

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

        await Offer.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Offer deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete offer'
        });
    }
};

const toggleOfferStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await Offer.findById(id);
        
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        const discountValue = offer.isActive ? offer.discountPercentage : 0;
        
        if (offer.type === 'product') {
            await Product.updateMany(
                { _id: { $in: offer.applicableTo } },
                { offer: discountValue }
            );
        } else if (offer.type === 'category') {
            await Category.updateMany(
                { _id: { $in: offer.applicableTo } },
                { offer: discountValue }
            );
            
            await Product.updateMany(
                { category: { $in: offer.applicableTo } },
                { categoryOffer: discountValue }
            );
        }

        res.json({
            success: true,
            message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`
        });

    } catch (error) {
        console.error('Error toggling offer status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle offer status'
        });
    }
};

module.exports = {
    getOffers,
    getAddOffer,
    createOffer,
    getEditOffer,
    updateOffer,
    deleteOffer,
    toggleOfferStatus
};
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const getAllCategories = async (req, res) => {
    try {
        const { search = '', sort = 'desc', page = 1 } = req.query;
        const sortOption = sort;
        const query = { isDeleted: false };
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        const sortQuery = { createdAt: -1 };

        const limit = 6;
        const categories = await Category.find(query)
            .sort(sortQuery)
            .skip((page - 1) * limit)
            .limit(limit);
        const total = await Category.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        res.render("categories", {
            categories,
            search,
            sortOption,
            currentPage: parseInt(page),
            totalPages
        });
    } catch (error) {
        console.error("Error loading categories page:", error);
        res.render("categories", {
            categories: [],
            search: '',
            sortOption: 'desc',
            currentPage: 1,
            totalPages: 1,
            message: { type: 'error', text: 'Error loading categories' }
        });
    }
};

const validateCategoryName = (name) => {
    const errors = [];
    
    if (!name || !name.trim()) {
        errors.push("Category name is required");
        return errors;
    }
    
    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
        errors.push("Category name must be at least 2 characters");
    }
    
    if (trimmedName.length > 50) {
        errors.push("Category name cannot exceed 50 characters");
    }
    
    if (!/^[a-zA-Z0-9\s-]+$/.test(trimmedName)) {
        errors.push("Category name can only contain letters, numbers, spaces, and hyphens");
    }
    
    return errors;
};

const checkDuplicateCategory = async (name, excludeId = null) => {
    const query = {
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        isDeleted: false
    };
    
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    
    const existingCategory = await Category.findOne(query);
    return existingCategory !== null;
};

const renderAddCategory = async (req, res) => {
    res.render("addCategory", { message: null });
};

const addCategory = async (req, res) => {
    try {
        const { name, description, isActive, offer } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                errors: { name: "Category name is required" },
                formData: { name: "", description: description || "", offer: offer || 0 }
            });
        }
        const image = req.file ? req.file.path : null;
        
        // Validate category name
        const nameErrors = validateCategoryName(name);
        if (nameErrors.length > 0) {
            return res.status(400).json({
                success: false,
                errors: { name: nameErrors[0] },
                formData: { name: name || '', description: description || '', offer: offer || 0 }
            });
        }
        
        const trimmedName = name.trim();
        
        // Check for duplicate category
        const isDuplicate = await checkDuplicateCategory(trimmedName);
        if (isDuplicate) {
            return res.status(400).json({
                success: false,
                errors: { name: "Category name already exists" },
                formData: { name: trimmedName, description: description || '', offer: offer || 0 }
            });
        }
        
        // Validate offer
        const parsedOffer = offer ? parseFloat(offer) : 0;
        if (isNaN(parsedOffer) || parsedOffer < 0 || parsedOffer > 50) {
            return res.status(400).json({
                success: false,
                errors: { offer: "Offer percentage must be a number between 0 and 50" },
                formData: { name: trimmedName, description: description || '', offer: offer || 0 }
            });
        }
        
        // Validate description length
        if (description && description.trim().length > 500) {
            return res.status(400).json({
                success: false,
                errors: { description: "Description cannot exceed 500 characters" },
                formData: { name: trimmedName, description: description || '', offer: offer || 0 }
            });
        }
        
        const category = new Category({
            name: trimmedName,
            description: description ? description.trim() : '',
            isActive: isActive === "on",
            image,
            offer: parsedOffer
        });

        await category.save();
        console.log(`Category saved with offer: ${category.offer}`);
        
        await Product.updateMany({ category: category._id }, { 
            categoryOffer: parsedOffer,
            isListed: category.isActive,
            isDeleted: false
        });
        console.log(`Updated products for category ${category._id} with categoryOffer: ${parsedOffer}, isListed: ${category.isActive}, isDeleted: false`);

        res.json({ success: true, message: "Category added successfully" });
    } catch (error) {
        console.error("Error adding category:", error);
        
        let errorMessage = "An error occurred while adding the category";
        let errorField = "general";
        
        if (error.code === 11000) {
            errorMessage = "Category name already exists";
            errorField = "name";
        } else if (error.name === 'ValidationError') {
            const firstError = Object.values(error.errors)[0];
            errorMessage = firstError.message;
            errorField = Object.keys(error.errors)[0];
        }
        
        res.status(500).json({
            success: false,
            errors: { [errorField]: errorMessage },
            formData: { 
                name: req.body.name || '', 
                description: req.body.description || '', 
                offer: req.body.offer || 0 
            }
        });
    }
};

const renderEditCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        if (!category) {
            return res.redirect("/admin/categories");
        }
        res.render("editCategory", { category, message: null });
    } catch (error) {
        console.error("Error rendering edit category:", error);
        res.redirect("/admin/categories");
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive, offer } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            errors: { name: "Category name is required" },
            formData: { name: "", description: description || "", offer: offer || 0 }
        });
    }
        const image = req.file ? req.file.path : null;
        
        // Check if category exists
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                errors: { general: "Category not found" }
            });
        }
        
        // Validate category name
        const nameErrors = validateCategoryName(name);
        if (nameErrors.length > 0) {
            return res.status(400).json({
                success: false,
                errors: { name: nameErrors[0] },
                formData: { name: name || '', description: description || '', offer: offer || 0 }
            });
        }
        
        const trimmedName = name.trim();
        
        // Check for duplicate category
        if (trimmedName.toLowerCase() !== existingCategory.name.toLowerCase()) {
            const isDuplicate = await checkDuplicateCategory(trimmedName, id);
            if (isDuplicate) {
                return res.status(400).json({
                    success: false,
                    errors: { name: "Category name already exists" },
                    formData: { name: trimmedName, description: description || '', offer: offer || 0 }
                });
            }
        }
        
        // Validate offer
        const parsedOffer = offer ? parseFloat(offer) : 0;
        if (isNaN(parsedOffer) || parsedOffer < 0 || parsedOffer > 50) {
            return res.status(400).json({
                success: false,
                errors: { offer: "Offer percentage must be a number between 0 and 50" },
                formData: { name: trimmedName, description: description || '', offer: offer || 0 }
            });
        }
        
        // Validate description length
        if (description && description.trim().length > 500) {
            return res.status(400).json({
                success: false,
                errors: { description: "Description cannot exceed 500 characters" },
                formData: { name: trimmedName, description: description || '', offer: offer || 0 }
            });
        }
        
        const updateData = {
            name: trimmedName,
            description: description ? description.trim() : '',
            isActive: isActive === "on",
            offer: parsedOffer
        };
        
        if (image) {
            updateData.image = image;
        }
        
        await Category.findByIdAndUpdate(id, updateData);
        console.log(`Category ${id} updated with offer: ${parsedOffer}, isActive: ${isActive === "on"}`);
        
        await Product.updateMany({ category: id, isDeleted: false }, { 
            categoryOffer: parsedOffer,
            isListed: isActive === "on"
        });
        console.log(`Updated products for category ${id} with categoryOffer: ${parsedOffer}, isListed: ${isActive === "on"}, isDeleted: false`);
        
        res.json({ success: true, message: "Category updated successfully" });
    } catch (error) {
        console.error("Error updating category:", error);
        
        let errorMessage = "An error occurred while updating the category";
        let errorField = "general";
        
        if (error.code === 11000) {
            errorMessage = "Category name already exists";
            errorField = "name";
        } else if (error.name === 'ValidationError') {
            const firstError = Object.values(error.errors)[0];
            errorMessage = firstError.message;
            errorField = Object.keys(error.errors)[0];
        }
        
        res.status(500).json({
            success: false,
            errors: { [errorField]: errorMessage },
            formData: { 
                name: req.body.name || '', 
                description: req.body.description || '', 
                offer: req.body.offer || 0 
            }
        });
    }
};

const softDeleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.findByIdAndUpdate(id, { isDeleted: true });
        await Product.updateMany({ category: id }, { isDeleted: true, isListed: false });
        console.log(`Soft-deleted category ${id} and marked associated products as isDeleted: true, isListed: false`);
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const category = await Category.findById(id);
        if (!category) {return res.status(404).json({ status: "error", message: "Category not found" });}

        const newStatus = !category.isActive;
        category.isActive = newStatus;
        await category.save();

        await Product.updateMany(
            { category: id, isDeleted: false },
            { $set: { isListed: newStatus } }
        );
        console.log(`Toggled category ${id} status to isActive: ${newStatus}. Updated products isListed to ${newStatus} for non-deleted products`);

        res.json({ status: "success", isActive: category.isActive });
    } catch (err) {
        console.error("Error toggling category status:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.findByIdAndUpdate(id, { offer: 0 });
        await Product.updateMany({ category: id, isDeleted: false }, { categoryOffer: 0 });
        console.log(`Removed offer for category ${id}, set to 0 for non-deleted products`);
        res.json({ success: true });
    } catch (err) {
        console.error("Error removing category offer:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const renderAddOfferForm = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        if (!category) {return res.redirect("/admin/categories");}

        res.render("addOffer", { category });
    } catch (err) {
        console.error("Error rendering add offer form:", err);
        res.redirect("/admin/categories");
    }
};

const updateCategoryOffer = async (req, res) => {
try {
const { id } = req.params;
const { offer } = req.body;
const parsedOffer = offer ? parseFloat(offer) : 0;
if (isNaN(parsedOffer) || parsedOffer < 0 || parsedOffer > 50) {
return res.status(400).send("Offer percentage must be a number between 0 and 50");
}
const category = await Category.findById(id);
if (!category) {return res.status(404).send("Category not found");}


category.offer = parsedOffer;
await category.save();


const products = await Product.find({ category: id, isDeleted: false });
for (const product of products) {
const effectiveOffer = Math.max(product.offer || 0, parsedOffer);
product.categoryOffer = parsedOffer;
product.salesPrice = effectiveOffer > 0
? product.price - (product.price * effectiveOffer / 100)
: product.price;
await product.save();
}


res.redirect("/admin/categories");
} catch (err) {
console.error("Error updating category offer:", err);
res.status(500).send("Error updating offer");
}
};

module.exports = {
    getAllCategories,
    renderAddCategory,
    addCategory,
    renderEditCategory,
    updateCategory,
    softDeleteCategory,
    toggleCategoryStatus,
    removeCategoryOffer,
    renderAddOfferForm,
    updateCategoryOffer,
};
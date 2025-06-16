const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const getAllCategories = async (req, res) => {
    try {
        const { search = '', sort = 'desc', page = 1 } = req.query;
        let sortOption = sort;
        let query = { isDeleted: false };
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        let sortQuery = { createdAt: -1 };
        if (sort === 'sales_desc') sortQuery = { sales: -1 };
        if (sort === 'sales_asc') sortQuery = { sales: 1 };

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

const renderAddCategory = async (req, res) => {
    res.render("addCategory", { message: null });
};

const addCategory = async (req, res) => {
    try {
        const { name, description, isActive, offer } = req.body;
        const image = req.file ? req.file.path : null;
        if (!name) {
            return res.render("addCategory", {
                message: { type: "error", text: "Category name is required" }
            });
        }
        const parsedOffer = offer ? parseFloat(offer) : 0;
        if (isNaN(parsedOffer) || parsedOffer < 0 || parsedOffer > 100) {
            return res.render("addCategory", {
                message: { type: "error", text: "Offer percentage must be a number between 0 and 100" }
            });
        }
        const category = new Category({
            name,
            description,
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

        res.redirect("/admin/categories");
    } catch (error) {
        let errorMessage = error.message;
        if (error.code === 11000) {
            errorMessage = "Category name already exists";
        }
        console.error("Error adding category:", error);
        res.render("addCategory", {
            message: { type: "error", text: `Error adding category: ${errorMessage}` }
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
        const image = req.file ? req.file.path : null;
        if (!name) {
            return res.render("editCategory", {
                category: await Category.findById(id),
                message: { type: "error", text: "Category name is required" }
            });
        }
        const parsedOffer = offer ? parseFloat(offer) : 0;
        if (isNaN(parsedOffer) || parsedOffer < 0 || parsedOffer > 100) {
            return res.render("editCategory", {
                category: await Category.findById(id),
                message: { type: "error", text: "Offer percentage must be a number between 0 and 100" }
            });
        }
        const updateData = {
            name,
            description,
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
        res.redirect("/admin/categories");
    } catch (error) {
        let errorMessage = error.message;
        if (error.code === 11000) {
            errorMessage = "Category name already exists";
        }
        console.error("Error updating category:", error);
        res.render("editCategory", {
            category: await Category.findById(req.params.id),
            message: { type: "error", text: `Error updating category: ${errorMessage}` }
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
        if (!category) return res.status(404).json({ status: "error", message: "Category not found" });

        category.isActive = !category.isActive;
        await category.save();
        await Product.updateMany({ category: id }, { isDeleted: true, isListed: false });
        console.log(`Toggled category ${id} status to isActive: ${category.isActive}, updated products isListed: ${category.isActive} for non-deleted products`);

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
        if (!category) return res.redirect("/admin/categories");

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
        if (isNaN(parsedOffer) || parsedOffer < 0 || parsedOffer > 100) {
            return res.status(400).send("Offer percentage must be a number between 0 and 100");
        }
        const category = await Category.findById(id);
        if (!category) return res.status(404).send("Category not found");

        category.offer = parsedOffer;
        await category.save();
        console.log(`Updated offer for category ${id} to ${parsedOffer}`);
        await Product.updateMany({ category: id, isDeleted: false }, { categoryOffer: parsedOffer });
        console.log(`Updated products for category ${id} with categoryOffer: ${parsedOffer} for non-deleted products`);
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
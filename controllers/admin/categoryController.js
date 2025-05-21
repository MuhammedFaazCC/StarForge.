const Category = require("../../models/categorySchema");

// GET all categories with search, pagination, sorting
const getAllCategories = async (req, res) => {
    try {
        const { search = '', sort = 'desc', page = 1 } = req.query;
        let sortOption = sort;
        let query = { isDeleted: false }; // Exclude soft-deleted categories
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        let sortQuery = { createdAt: -1 };
        if (sort === 'sales_desc') sortQuery = { sales: -1 };
        if (sort === 'sales_asc') sortQuery = { sales: 1 };

        const limit = 10;
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
        const { name, description, isActive } = req.body;
        const image = req.file ? req.file.path : null;
        if (!name) {
            return res.render("addCategory", {
                message: { type: "error", text: "Category name is required" }
            });
        }
        const category = new Category({
            name,
            description,
            isActive: isActive === "on",
            image
        });
        await category.save();
        res.redirect("/admin/categories");
    } catch (error) {
        let errorMessage = error.message;
        if (error.code === 11000) {
            errorMessage = "Category name already exists";
        }
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
        res.redirect("/admin/categories");
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;
        const image = req.file ? req.file.path : null;
        if (!name) {
            return res.render("editCategory", {
                category: await Category.findById(id),
                message: { type: "error", text: "Category name is required" }
            });
        }
        const updateData = {
            name,
            description,
            isActive: isActive === "on"
        };
        if (image) {
            updateData.image = image;
        }
        await Category.findByIdAndUpdate(id, updateData);
        res.redirect("/admin/categories");
    } catch (error) {
        let errorMessage = error.message;
        if (error.code === 11000) {
            errorMessage = "Category name already exists";
        }
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
        res.json({ success: true });
    } catch (error) {
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

        res.json({ status: "success", isActive: category.isActive });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.findByIdAndUpdate(id, { $unset: { offer: "" } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const renderAddOfferForm = async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return res.redirect("/admin/categories");

    res.render("addOffer", { category });
};

const updateCategoryOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { offer } = req.body;
        const category = await Category.findById(id);
        if (!category) return res.status(404).send("Category not found");

        category.offer = offer;
        await category.save();
        res.redirect("/admin/categories");
    } catch (err) {
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
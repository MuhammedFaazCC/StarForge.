const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer');
const adminController = require("../controllers/admin/adminController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require('../controllers/admin/adminProductController');
const customerController = require('../controllers/admin/customerController');
const { adminAuth } = require("../middlewares/auth");

router.get("/", function(req, res, next) {
    if (req.session.admin && req.session.admin._id) {
        console.log("Router-level redirect: Admin already logged in");
        return res.redirect("/admin/dashboard");
    }
    next();
}, adminController.loginPage);

router.post("/", function(req, res, next) {
    if (req.session.admin && req.session.admin._id) {
        console.log("Router-level redirect: Admin already logged in");
        return res.redirect("/admin/dashboard");
    }
    next();
}, adminController.login);

router.get("/dashboard", adminAuth, adminController.dashboardPage);
router.get("/logout", adminController.logout);

router.get("/products", adminAuth, productController.productsPage);
router.get("/products/add", adminAuth, productController.addProduct);
router.post("/products/add", adminAuth, upload.fields([{ name: 'mainImage', maxCount: 1 },{ name: 'additionalImages', maxCount: 5 }]), productController.productAdd);
router.get("/products/view/:id", adminAuth, productController.viewProduct);
router.get("/products/edit/:id", adminAuth, productController.editProduct);
router.post('/products/edit/:id', adminAuth, upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'additionalImages', maxCount: 5 }
]), productController.productEdit);
router.delete("/products/delete/:id", adminAuth, productController.softDeleteProduct);

router.get("/orders", adminAuth, adminController.ordersPage);

router.get("/customers", adminAuth, customerController.customersPage);
router.post('/customers/clear', adminAuth, customerController.customerClear);
router.get('/customers/add', adminAuth, customerController.addCustomer);
router.get('/customers/search', adminAuth, customerController.searchCustomers);
router.get('/customers/:id', adminAuth, customerController.getCustomerById);
router.patch('/customers/:id/:action', adminAuth, customerController.customerToggleBlock);

router.get("/sales", adminAuth, adminController.salesPage);

router.get("/coupons", adminAuth, adminController.couponsPage);

router.get('/categories', adminAuth, categoryController.getAllCategories);
router.get('/categories/add', adminAuth, categoryController.renderAddCategory);
router.post('/categories/add', adminAuth, upload.single('image'), categoryController.addCategory);
router.get('/categories/edit/:id', adminAuth, categoryController.renderEditCategory);
router.post('/categories/edit/:id', adminAuth, upload.single('image'), categoryController.updateCategory);
router.patch('/categories/delete/:id', adminAuth, categoryController.softDeleteCategory);
router.post('/categories/toggle-status', adminAuth, categoryController.toggleCategoryStatus);
router.post('/categories/offer/:id', adminAuth, categoryController.updateCategoryOffer);
router.delete('/categories/offer/:id', adminAuth, categoryController.removeCategoryOffer);

module.exports = router;
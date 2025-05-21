const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer');
const adminController = require("../controllers/admin/adminController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require('../controllers/admin/productController');
const customerController = require('../controllers/admin/customerController');

router.get("/", adminController.loginPage);
router.post("/", adminController.login);

router.get("/dashboard", adminController.dashboardPage);

router.get("/products", productController.productsPage);
router.get("/products/add", productController.addProduct);
router.post("/products/add", upload.fields([ { name: 'mainImage', maxCount: 1 }, { name: 'additionalImages', maxCount: 5 } ]), productController.productAdd);
router.get("/products/view/:id", productController.viewProduct);
router.get("/products/edit/:id", productController.editProduct);
router.post('/products/edit/:id', upload.fields([ { name: 'mainImage', maxCount: 1 }, { name: 'additionalImages', maxCount: 5 } ]), productController.productEdit);
router.delete("/products/delete/:id",productController.softDeleteProduct)


router.get("/orders", adminController.ordersPage);

router.get("/customers", customerController.customersPage);
router.post('/customers/clear', customerController.customerClear);
router.get('/customers/add', customerController.addCustomer);
router.get('/customers', customerController.getAllCustomers);
router.get('/customers/search', customerController.searchCustomers);
router.get('/customers/:id', customerController.getCustomerById);
router.patch('/customers/:id/:action', customerController.customerToggleBlock);

router.get("/sales", adminController.salesPage);

router.get("/coupons", adminController.couponsPage);


router.get('/categories', categoryController.getAllCategories);
router.get('/categories/add', categoryController.renderAddCategory);
router.post('/categories/add', upload.single('image'), categoryController.addCategory);
router.get('/categories/edit/:id', categoryController.renderEditCategory);
router.post('/categories/edit/:id', upload.single('image'), categoryController.updateCategory);
router.patch('/categories/delete/:id', categoryController.softDeleteCategory);
router.post('/categories/toggle-status', categoryController.toggleCategoryStatus);
router.post('/categories/offer/:id', categoryController.updateCategoryOffer);
router.delete('/categories/offer/:id', categoryController.removeCategoryOffer);

module.exports = router;

module.exports = router;
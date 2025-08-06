const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer');
const adminController = require("../controllers/admin/adminController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require('../controllers/admin/adminProductController');
const customerController = require('../controllers/admin/customerController');
const offerController = require('../controllers/admin/offerController');
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
router.post('/products/edit/:id', adminAuth, upload.fields([ { name: 'mainImage', maxCount: 1 }, { name: 'additionalImages', maxCount: 5 } ]), productController.productEdit);
router.delete("/products/delete/:id", adminAuth, productController.softDeleteProduct);
router.patch('/products/toggle-listing/:id', adminAuth, productController.toggleListing);

router.get('/orders', adminAuth, adminController.getAdminOrdersPage);
router.get('/orders/:id', adminAuth, adminController.getOrderDetails);
router.get("/orders/:id/invoice", adminAuth, adminController.getInvoicePDF);
router.post('/orders/:id/status', adminAuth, adminController.statusUpdate);
router.post('/orders/:orderId/items/:itemId/status', adminAuth, adminController.updateItemStatus);

router.get('/returns', adminAuth, adminController.getReturnRequestsPage);
router.post('/order/return/accept/:id', adminAuth, adminController.acceptReturnRequest);
router.post('/order/return/decline/:id', adminAuth, adminController.declineReturnRequest);

router.post('/order/:orderId/item/:productId/return/accept', adminAuth, adminController.acceptItemReturnRequest);
router.post('/order/:orderId/item/:productId/return/decline', adminAuth, adminController.declineItemReturnRequest);
router.get('/coupons', adminAuth, adminController.couponsPage);
router.get('/coupons/create', adminAuth, adminController.getCreateCouponPage);
router.post('/coupons/create', adminAuth, adminController.postCreateCoupon);
router.delete('/coupons/delete/:id', adminAuth, adminController.deleteCoupon);

router.get("/customers", adminAuth, customerController.customersPage);
router.post('/customers/clear', adminAuth, customerController.customerClear);
router.get('/customers/add', adminAuth, customerController.addCustomer);
router.get('/customers/search', adminAuth, customerController.searchCustomers);
router.get('/customers/:id', adminAuth, customerController.getCustomerById);
router.patch('/customers/:id/:action', adminAuth, customerController.customerToggleBlock);

router.get("/sales", adminAuth, adminController.salesPage);
router.get("/sales/export/pdf", adminAuth, adminController.exportSalesReportPDF);
router.get("/sales/export/excel", adminAuth, adminController.exportSalesReportExcel);
router.get("/sales/export/csv", adminAuth, adminController.exportSalesReportCSV);
router.get("/sales/chart-data", adminAuth, adminController.getSalesChartData);

router.get('/categories', adminAuth, categoryController.getAllCategories);
router.get('/categories/add', adminAuth, categoryController.renderAddCategory);
router.post('/categories/add', adminAuth, upload.single('image'), categoryController.addCategory);
router.get('/categories/edit/:id', adminAuth, categoryController.renderEditCategory);
router.post('/categories/edit/:id', adminAuth, upload.single('image'), categoryController.updateCategory);
router.patch('/categories/delete/:id', adminAuth, categoryController.softDeleteCategory);
router.post('/categories/toggle-status', adminAuth, categoryController.toggleCategoryStatus);
router.post('/categories/offer/:id', adminAuth, categoryController.updateCategoryOffer);
router.delete('/categories/offer/:id', adminAuth, categoryController.removeCategoryOffer);

router.get('/offers', adminAuth, offerController.getOffers);
router.get('/offers/add', adminAuth, offerController.getAddOffer);
router.post('/offers/add', adminAuth, offerController.createOffer);
router.get('/offers/edit/:id', adminAuth, offerController.getEditOffer);
router.post('/offers/edit/:id', adminAuth, offerController.updateOffer);
router.delete('/offers/delete/:id', adminAuth, offerController.deleteOffer);
router.patch('/offers/toggle/:id', adminAuth, offerController.toggleOfferStatus);

module.exports = router;
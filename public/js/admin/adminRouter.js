const express = require ('express');
const router = express.Router();
const adminController = require("../../../controllers/admin/adminController");

router.get("/", adminController.loginPage);
router.post("/", adminController.login);

router.get("/dashboard", adminController.dashboardPage);

router.get("/products", adminController.productsPage);

router.get("/orders", adminController.ordersPage);

router.get("/customers", adminController.customersPage);
router.post('/customers/:id/:action', adminController.customerBlock);
router.post('/customers/clear', adminController.customerClear);
router.get('/customers/add', adminController.addCustomer);
router.post('/customers', adminController.customerAdd);

router.get("/sales", adminController.salesPage);

router.get("/coupons", adminController.couponsPage);

router.get("/banners", adminController.bannersPage);

module.exports = router;
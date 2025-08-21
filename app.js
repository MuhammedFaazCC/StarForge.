const express = require("express");
const path = require("path");
const db = require("./config/db");
const flash = require('connect-flash');
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require('express-session');
const passport = require('./config/passport');
const cartWishlistCount = require('./middlewares/cartWishlistCount');
require('dotenv').config();

const app = express();
db();
app.use(flash());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/user"),
]);

app.use(session({
    secret: process.env.SESSION_SECRET || 'starforge-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    if (req.path === '/admin' || req.path === '/admin/') {
        if (req.session.admin && req.session.admin._id) {
            console.log("Admin redirect middleware: redirecting to dashboard");
            return res.redirect('/admin/dashboard');
        }
    }
    next();
});

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null;
    res.locals.error = req.session.error || null;
    res.locals.success = req.session.success || null;
    res.locals.message = req.session.message || null;
    next();
});

app.use(cartWishlistCount);

app.use("/", userRouter);
app.use("/admin", adminRouter);
app.use((req, res,error) => { 
  console.log(error)
  res.status(404).render("pageNotFound");
});
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}/`);
});

module.exports = app;
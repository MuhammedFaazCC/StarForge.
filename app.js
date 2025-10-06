const express = require("express");
const path = require("path");
const db = require("./config/db");
const flash = require('connect-flash');
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require('express-session');
const MongoStore = require('connect-mongo');
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

// Setup a shared Mongo session store
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/StarForge';
const sessionStore = MongoStore.create({
  mongoUrl,
  collectionName: 'sessions',
});

// Define distinct session middlewares
const adminSession = session({
  name: 'admin_session',
  secret: process.env.ADMIN_SESSION_SECRET || 'starforge-admin-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
});

const userSession = session({
  name: 'user_session',
  secret: process.env.USER_SESSION_SECRET || 'starforge-user-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
});

// Apply sessions per namespace
app.use('/admin', adminSession);
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) return next();
  return userSession(req, res, next);
});

// Passport should only attach session for user side
app.use(passport.initialize());
const passportSession = passport.session();
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) return next();
  return passportSession(req, res, next);
});

app.use((req, res, next) => {
    if (req.path === '/admin' || req.path === '/admin/') {
        if (req.session && req.session.admin && req.session.admin._id) {
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
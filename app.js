const express = require("express");
const path = require("path");
const multer = require("multer");
const db = require("./config/db");
const flash = require("connect-flash");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("./config/passport");
const cartWishlistCount = require("./middlewares/cartWishlistCount");
require("dotenv").config();

const app = express();

db();

/* ---------------- View engine ---------------- */
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/user"),
]);

/* ---------------- Core middleware ---------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(flash());

/* ---------------- Session store ---------------- */
const mongoUrl = process.env.MONGODB_URI;
const sessionStore = MongoStore.create({
  mongoUrl,
  collectionName: "sessions",
});

/* ---------------- Sessions ---------------- */
const adminSession = session({
  name: "admin_session",
  secret: process.env.ADMIN_SESSION_SECRET || "starforge-admin-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
});

const userSession = session({
  name: "user_session",
  secret: process.env.USER_SESSION_SECRET || "starforge-user-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
});

/* ---------------- Apply sessions ---------------- */
app.use("/admin", adminSession);
app.use((req, res, next) => {
  if (req.path.startsWith("/admin")){return next()};
  return userSession(req, res, next);
});

/* ---------------- Passport ---------------- */
app.use(passport.initialize());
const passportSession = passport.session();
app.use((req, res, next) => {
  if (req.path.startsWith("/admin")){return next()};
  return passportSession(req, res, next);
});

/* ---------------- Cache control (must be BEFORE routes) ---------------- */
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

/* ---------------- Admin root redirect ---------------- */
app.use((req, res, next) => {
  if ((req.path === "/admin" || req.path === "/admin/") &&
      req.session?.admin?._id) {
    return res.redirect("/admin/dashboard");
  }
  next();
});

/* ---------------- res.locals ---------------- */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.admin = req.session.admin || null;
  res.locals.error = req.session.error || null;
  res.locals.success = req.session.success || null;
  res.locals.message = req.session.message || null;
  next();
});

/* ---------------- Cart / Wishlist counts ---------------- */
app.use(cartWishlistCount);

/* ---------------- Routes ---------------- */
app.use("/", userRouter);
app.use("/admin", adminRouter);

/* ---------------- 404 handler ---------------- */
app.use((req, res) => {
  res.status(404).render("pageNotFound");
});

/* ---------------- Error handler ---------------- */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  // Multer errors (API-safe)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // File-related errors
  if (err?.message?.toLowerCase().includes("file")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Page render fallback
  return res.status(500).render("error", {
    statusCode: 500,
    error: err.message || "Something went wrong. Please try again later.",
    user: req.session?.user || null
  });
});

/* ---------------- Server ---------------- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}/`);
});

module.exports = app;

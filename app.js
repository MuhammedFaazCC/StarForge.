const express = require("express");
const mongoose = require('mongoose');
const path = require("path");
const db = require("./config/db");
const flash = require('connect-flash');
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require('express-session');
const passport = require('./config/passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const app = express();
db();
app.use(flash());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", [ path.join(__dirname, "views/admin"), path.join(__dirname, "views/user"), ]);

app.use(session({
    secret: process.env.SESSION_SECRET || 'starforge-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use("/", userRouter);
 app.use("/admin", adminRouter);
app.use((req, res) => { 
  res.status(404).render("pageNotFound");
});
 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}/`);
});

module.exports = app;
const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  // Check if user session exists and has userId
  if (req.session.user && req.session.user._id) {
    // Find user in database to ensure they're still valid
    User.findById(req.session.user._id)
      .then(data => {
        if (data && !data.isBlocked) {
          // Add full user data to res.locals to make it available in templates
          res.locals.userData = data;
          // Continue to the requested route
          next();
        } else {
          // Clear session if user is blocked or deleted
          req.session.error = data ? "Your account has been blocked by an admin" : "User not found";
          req.session.destroy((err) => {
            if (err) {
              console.error("Session destroy error:", err);
            }
            res.redirect("/login");
          });
        }
      })
      .catch(error => {
        console.log("Error in userAuth middleware:", error);
        res.status(500).send("Internal server error");
      });
  } else {
    // No valid session, redirect to login
    req.session.error = "Please log in to access this page";
    res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {
  if (req.session.admin && req.session.admin._id) {
    User.findById(req.session.admin._id)
      .then(data => {
        if (data && data.role === "admin" && !data.isBlocked) {
          res.locals.adminData = data;
          next();
        } else {
          delete req.session.admin;
          req.session.error = "Admin session expired or invalid";
          req.session.save((err) => {
            if (err) {
              console.error("Session save error:", err);
            }
            res.redirect("/admin");
          });
        }
      })
      .catch(error => {
        console.log("Error in adminAuth middleware:", error);
        res.status(500).send("Internal server error");
      });
  } else {
    res.redirect("/admin");
  }
};

module.exports = {
  userAuth,
  adminAuth
};
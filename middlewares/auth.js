const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(data => {
        if (data && !data.isBlocked) {
          res.locals.userData = data;
          next();
        } else {
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
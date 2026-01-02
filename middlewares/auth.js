const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
  try {
    // No session or no user
    if (!req.session || !req.session.user || !req.session.user._id) {
      if (
        req.headers.accept?.includes('application/json') ||
        req.headers['x-requested-with'] === 'XMLHttpRequest'
      ) {
        return res.status(401).json({
          success: false,
          message: 'User not logged in'
        });
      }

      req.session.error = 'Please log in to access this page';
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user._id);

    // User missing or blocked
    if (!user || user.isBlocked) {
      if (
        req.headers.accept?.includes('application/json') ||
        req.headers['x-requested-with'] === 'XMLHttpRequest'
      ) {
        return res.status(403).json({
          success: false,
          message: 'Account blocked or user not found'
        });
      }

      req.session.error = user
        ? 'Your account has been blocked by an admin'
        : 'User not found';

      req.session.destroy(() => {
        return res.redirect('/login');
      });
    }

    // Auth success
    res.locals.userData = user;
    next();

  } catch (error) {
    console.error('Error in userAuth middleware:', error);

    if (
      req.headers.accept?.includes('application/json') ||
      req.headers['x-requested-with'] === 'XMLHttpRequest'
    ) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }

    res.status(500).send('Internal server error');
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
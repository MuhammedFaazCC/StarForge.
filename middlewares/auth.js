const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
  try {
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

      if (req.session) {
        req.session.error = 'Please log in to access this page';
      }
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user._id);

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

      const msg = user
        ? 'Your account has been blocked by an admin'
        : 'User not found';

      return req.session.regenerate(err => {
        if (err) return res.redirect('/login');
        req.session.error = msg;
        return res.redirect('/login');
      });
    }

    res.locals.userData = user;
    return next();

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

    return res.status(500).send('Internal server error');
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

const softUserCheck = async (req, res, next) => {
  try {
    if (!req.session || !req.session.user || !req.session.user._id) {
      return next();
    }

    const user = await User.findById(req.session.user._id);

    if (!user || user.isBlocked) {
      const msg = user
        ? 'Your account has been blocked by an admin'
        : 'User not found';

      return req.session.regenerate(err => {
        if (err) return res.redirect('/login');
        req.session.error = msg;
        return res.redirect('/login');
      });
    }

    res.locals.userData = user;
    return next();

  } catch (err) {
    console.error("Error in softUserCheck:", err);
    return next();
  }
};

module.exports = {
  userAuth,
  adminAuth,
  softUserCheck
};
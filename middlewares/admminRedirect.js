
const adminRedirectIfLoggedIn = (req, res, next) => {
    // If admin is logged in, redirect to dashboard
    if (req.session.admin && req.session.admin._id) {
        return res.redirect('/admin/dashboard');
    }
    // Otherwise continue to the requested route
    next();
};

module.exports = {
    adminRedirectIfLoggedIn
};
const forgotPasswordPage = async (req, res) => {
  try {
    const error = req.session.error || null;
    req.session.error = null;
    return res.render("forgotPassword", { error, success: null });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.session.error = "Email not found";
      return res.redirect("/forgotPassword");
    }

    if (user.isBlocked) {
      req.session.error = "Your account has been blocked by an admin";
      return res.redirect("/forgotPassword");
    }

    const otp = generateOTP();
    req.session.otp = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000,
      userId: user._id,
      action: "forgotPassword",
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error in forgotPassword:", err);
        req.session.error = "Failed to send OTP. Please try again.";
        return res.redirect("/forgotPassword");
      }

      sendOTP(email, otp)
        .then(() => {
          res.redirect("/otp-verification");
        })
        .catch((error) => {
          console.error("Error sending OTP:", error);
          req.session.error = "Failed to send OTP. Please try again.";
          res.redirect("/forgotPassword");
        });
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error.message);
    req.session.error = "Failed to send OTP. Please try again.";
    res.redirect("/forgotPassword");
  }
};

const resetPassword = async (req, res) => {
  try {
    if (!req.session.resetUserId) {
      req.session.error = "Reset session expired";
      return res.redirect("/forgotPassword");
    }
    const error = req.session.error || null;
    req.session.error = null;
    res.render("resetPassword", { error });
  } catch (error) {
    console.error("Error rendering reset page:", error);
    res.status(500).send("Server error");
  }
};

const passwordReset = async (req, res) => {
  const { password, confirmPassword } = req.body;

  try {
    if (!req.session.resetUserId) {
      req.session.error = "Reset session expired";
      return res.redirect("/forgotPassword");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/resetPassword");
    }

    if (password.length < 6) {
      req.session.error = "Password must be at least 6 characters";
      return res.redirect("/resetPassword");
    }

    const user = await User.findById(req.session.resetUserId);
    if (!user) {
      req.session.error = "User not found";
      return res.redirect("/resetPassword");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    delete req.session.resetUserId;

    req.session.success =
      "Password reset successfully. Please login with your new password.";
    return res.redirect("/login");
  } catch (error) {
    console.error("Error in resetPasswordPost:", error);
    req.session.error = "Something went wrong. Please try again.";
    res.redirect("/resetPassword");
  }
};

// const resetPasswordGet = async (req, res) => {
//   try {
//     if (!req.session.resetUserId) {
//       req.session.error = "Reset session expired";
//       return res.redirect("/forgotPassword");
//     }
//     const error = req.session.error || null;
//     req.session.error = null;
//     res.render("resetPassword", { error });
//   } catch (error) {
//     console.log("Page not found");
//     res.status(500).send("Server error");
//   }
// };

// const resetPasswordPost = async (req, res) => {
//   const { password, confirmPassword } = req.body;

//   try {
//     if (!req.session.resetUserId) {
//       req.session.error = "Reset session expired";
//       return res.redirect("/forgotPassword");
//     }

//     if (password !== confirmPassword) {
//       req.session.error = "Passwords do not match";
//       return res.redirect("/resetPassword");
//     }

//     if (password.length < 6) {
//       req.session.error = "Password must be at least 6 characters";
//       return res.redirect("/resetPassword");
//     }

//     const user = await User.findById(req.session.resetUserId);
//     if (!user) {
//       req.session.error = "User not found";
//       return res.redirect("/resetPassword");
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     user.password = hashedPassword;
//     await user.save();

//     delete req.session.resetUserId;

//     req.session.save((err) => {
//       if (err) {
//         console.error("Session save error in resetPasswordPost:", err);
//       }
//       req.session.success =
//         "Password reset successfully. Please login with your new password.";
//       return res.redirect("/login");
//     });
//   } catch (error) {
//     console.error("Error in resetPasswordPost:", error);
//     req.session.error = "An error occurred";
//     res.redirect("/resetPassword");
//   }
// };

const getChangePassword = async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    const cartCount = await getCartCount(userId);

    res.render("profileChangePassword", {
      user: req.session.user,
      error: req.session.error,
      success: req.session.success,
      cartCount
    });
    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Error loading change password page:", error);
    res.render("profileChangePassword", {
      user: req.session.user,
      error: req.session.error,
      success: req.session.success,
      cartCount: 0
    });
    req.session.error = null;
    req.session.success = null;
  }
};

const postChangePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findById(req.session.user._id);

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      req.session.error = "Incorrect current password.";
      return res.redirect("/changePassword");
    }

    if (newPassword !== confirmPassword) {
      req.session.error = "New passwords do not match.";
      return res.redirect("/changePassword");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    req.session.success = "Password changed successfully.";
    res.redirect("/changePassword");
  } catch (err) {
    console.error(err);
    req.session.error = "Something went wrong. Please try again.";
    res.redirect("/changePassword");
  }
};

module.exports = {
    forgotPasswordPage,
    forgotPassword,
    resetPassword,
    passwordReset,
    // resetPasswordGet,
    // resetPasswordPost,
    getChangePassword,
    postChangePassword
}
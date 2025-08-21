const otpVerificationPage = async (req, res) => {
  try {
    const otpSession = req.session.otp;

    if (!otpSession) {
      req.session.error = "No OTP session found";
      return res.redirect("/login");
    }

    const error = req.session.error || null;
    req.session.error = null;

    const otpAction = otpSession.action;

    res.render("otpVerification", {
      error,
      success: null,
      otpAction,
    });
  } catch (error) {
    console.log("Error rendering OTP page:", error);
    res.status(500).send("Server error");
  }
};

const verifyOTP = async (req, res) => {
  const { otp } = req.body;

  try {
    if (!req.session.otp || !otp) {
      req.session.error = "No OTP session found or OTP not provided";
      return res.redirect("/otp-verification");
    }

    const { code, expires, action } = req.session.otp;

    if (Date.now() > expires) {
      delete req.session.otp;
      req.session.error = "OTP has expired";
      return res.redirect("/otp-verification");
    }

    if (otp !== code) {
      req.session.error = "Invalid OTP";
      return res.redirect("/otp-verification");
    }

    if (action === "signup") {
      const { fullName, email, mobile, password, referralCode } =
        req.session.otp.userData;

      const hashedPassword = await bcrypt.hash(password, 10);
      const newReferralCode = Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase();
      
      const crypto = require('crypto');
      const referralToken = crypto.randomBytes(32).toString('hex');

      const newUser = await User.create({
        fullName,
        email,
        mobile,
        password: hashedPassword,
        referralCode: newReferralCode,
        referralToken: referralToken,
        role: "customer",
        isActive: true,
      });

      if (referralCode) {
        try {
          const { processReferralSignup } = require('./referralController');
          await processReferralSignup(referralCode, newUser._id);
        } catch (referralError) {
          console.error('Error processing referral:', referralError);
        }
      }

      req.session.user = {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        referralCode: newUser.referralCode,
        isLoggedIn: true,
      };

      delete req.session.otp;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error in verifyOTP (signup):", err);
          req.session.error =
            "Account created but login failed. Please login manually.";
          return res.redirect("/login");
        }
        req.session.success = "Account created successfully!";
        return res.redirect("/");
      });
    } else if (action === "forgotPassword") {
      req.session.resetUserId = req.session.otp.userId;
      delete req.session.otp;

      req.session.save((err) => {
        if (err) {
          console.error(
            "Session save error in verifyOTP (forgot password):",
            err
          );
          req.session.error =
            "Verification successful but session error occurred";
          return res.redirect("/forgotPassword");
        }
        return res.redirect("/resetPassword");
      });
    } else if (action === "editProfile") {
      const { fullName, email, mobile, profileImage } = req.session.otp.userData;
      const userId = req.session.user._id;
      
      try {
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          {
            fullName: fullName.trim(),
            email: email,
            mobile: mobile || null,
            profileImage: profileImage,
          },
          { new: true }
        );

        if (!updatedUser) {
          req.session.error = "Failed to update profile";
          return res.redirect('/LoadProfile');
        }

        req.session.user = {
          ...req.session.user,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          mobile: updatedUser.mobile,
          profileImage: updatedUser.profileImage
        };

        delete req.session.otp;
        req.session.success = "Profile updated successfully";
        res.redirect('/LoadProfile');
      } catch (updateError) {
        console.error("Error updating profile after OTP verification:", updateError);
        req.session.error = "Failed to update profile";
        res.redirect('/LoadProfile');
      }
    }
  } catch (error) {
    console.error("Error in verifyOTP:", error.message);
    req.session.error = error.message || "An error occurred";
    res.redirect("/otp-verification");
  }
};

module.exports = {
    otpVerificationPage,
    verifyOTP
}
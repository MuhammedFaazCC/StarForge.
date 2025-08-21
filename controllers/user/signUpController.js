const signUpPage = async (req, res) => {
  try {
    const error = req.session.error || null;
    req.session.error = null;
    
    const referralToken = req.query.ref;
    let referrerInfo = null;
    
    if (referralToken) {
      try {
        const referringUser = await User.findOne({ 
          referralToken: referralToken,
          isActive: true,
          isBlocked: false 
        }).select('fullName');
        
        if (referringUser) {
          referrerInfo = {
            name: referringUser.fullName,
            token: referralToken
          };
        }
      } catch (err) {
        console.error('Error validating referral token:', err);
      }
    }
    
    return res.render("signUp", { error, referrerInfo });
  } catch (error) {
    console.log("Page not found");
    res.status(500).send("Server error");
  }
};

const signUp = async (req, res) => {
  const { fullName, email, mobile, password, confirmPassword, referralCode } =
    req.body;
  try {
    if (
      !fullName ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 50
    ) {
      req.session.error = "Full name must be between 2 and 50 characters";
      return res.redirect("/signup");
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      req.session.error = "Please provide a valid email address";
      return res.redirect("/signup");
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobile || !mobileRegex.test(mobile)) {
      req.session.error = "Mobile number must be exactly 10 digits";
      return res.redirect("/signup");
    }

    if (!password || password.length < 6) {
      req.session.error = "Password must be at least 6 characters";
      return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
      req.session.error = "Passwords do not match";
      return res.redirect("/signup");
    }

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      req.session.error = "Email or mobile number already exists";
      return res.redirect("/signup");
    }

    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });
      if (!referringUser) {
        req.session.error = "Invalid referral code";
        return res.redirect("/signup");
      }
    }

    const otp = generateOTP();
    req.session.otp = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000,
      userData: { fullName, email, mobile, password, referralCode },
      action: "signup",
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error in signUp:", err);
        req.session.error = "Failed to send OTP. Please try again.";
        return res.redirect("/signup");
      }

      sendOTP(email, otp)
        .then(() => {
          res.redirect("/otp-verification");
        })
        .catch((error) => {
          console.error("Error sending OTP:", error);
          req.session.error = "Failed to send OTP. Please try again.";
          res.redirect("/signup");
        });
    });
  } catch (error) {
    console.error("Error in signUp:", error.message);
    req.session.error = "Failed to send OTP. Please try again.";
    res.redirect("/signup");
  }
};

module.exports = {
    signUpPage,
    signUp
}
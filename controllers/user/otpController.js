const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const User = require("../../models/userSchema");

// Utilities for OTP resend
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOTP(email, otp) {
  const mailOptions = {
    from: `"StarForge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "StarForge OTP Verification",
    html: `
      <h2>Your OTP Code</h2>
      <p>Your one-time password (OTP) is <strong>${otp}</strong>.</p>
      <p>Please enter this code on the verification page to proceed.</p>
      <p>This OTP is valid for 5 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  };
  return transporter.sendMail(mailOptions);
}

const resendOTP = async (req, res) => {
  try {
    // Prevent duplicate resend within a short window
    const now = Date.now();
    const lastSend = req.session._otp_sending_ts || 0;
    if (now - lastSend < 4000) {
      return res.status(429).json({ success: false, message: "Please wait a moment before retrying." });
    }

    const otpSession = req.session.otp;
    if (!otpSession) {
      return res.status(400).json({ success: false, message: "No OTP session found" });
    }

    const { action } = otpSession;
    let email = null;

    if (action === "signup" || action === "editProfile") {
      email = otpSession.userData && otpSession.userData.email;
    } else if (action === "forgotPassword") {
      if (!otpSession.userId) {
        return res.status(400).json({ success: false, message: "No user context for OTP resend" });
      }
      const user = await User.findById(otpSession.userId).select("email");
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      email = user.email;
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "No email available to resend OTP" });
    }

    const newCode = generateOTP();
    req.session.otp.code = newCode;
    req.session.otp.expires = Date.now() + 5 * 60 * 1000; // extend validity
    req.session._otp_sending_ts = Date.now();

    req.session.save(async (err) => {
      if (err) {
        console.error("Session save error in resendOTP:", err);
        return res.status(500).json({ success: false, message: "Failed to update session" });
      }
      try {
        await sendOTP(email, newCode);
        return res.json({ success: true, message: "OTP resent successfully" });
      } catch (sendErr) {
        console.error("Error resending OTP:", sendErr);
        return res.status(500).json({ success: false, message: "Failed to resend OTP" });
      }
    });
  } catch (error) {
    console.error("Error in resendOTP:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

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
    verifyOTP,
    resendOTP
}
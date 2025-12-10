const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

if (process.env.NODE_ENV === "development") {
  transporter.verify().then(() => console.log("Mail server ready"));
}

const sendOTP = async (email, otp) => {
  try {
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

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

// GET /signup
const signUpPage = async (req, res) => {
  try {
    const error = req.session.error || null;
    req.session.error = null;

    // Now URL carries referral CODE, not token
    const referralCodeFromUrl = req.query.ref;
    let referrerInfo = null;

    if (referralCodeFromUrl) {
      try {
        const referringUser = await User.findOne({
          referralCode: referralCodeFromUrl,
          isActive: true,
          isBlocked: false,
        }).select("fullName referralCode");

        if (referringUser) {
          // store referral identifier in session for later OTP step
          req.session.referralIdentifier = referringUser.referralCode;

          referrerInfo = {
            name: referringUser.fullName,
            code: referringUser.referralCode,
          };
        }
      } catch (err) {
        console.error("Error validating referral code in signUpPage:", err);
      }
    }

    return res.render("signUp", { error, referrerInfo });
  } catch (error) {
    console.error("SignUpPage Error:", error);
    res.status(500).send("Server error");
  }
};

// POST /signup
const signUp = async (req, res) => {
  const { fullName, email, mobile, password, confirmPassword, referralCode } =
    req.body || {};
  try {
    // Prevent duplicate OTP sends within a short window (e.g., double-click)
    const now = Date.now();
    const lastSend = req.session._otp_sending_ts || 0;
    if (now - lastSend < 4000) {
      return res.json({
        success: false,
        message: "Please wait a moment before retrying.",
      });
    }

    // Basic validations
    if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 50) {
      return res.json({
        success: false,
        field: "fullName",
        message: "Full name must be between 2 and 50 characters",
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      return res.json({
        success: false,
        field: "email",
        message: "Please provide a valid email address",
      });
    }

    const mobileRegex = /^\d{10}$/;
    if (!mobile || !mobileRegex.test(mobile)) {
      return res.json({
        success: false,
        field: "mobile",
        message: "Mobile number must be exactly 10 digits",
      });
    }

    if (!password || password.length < 6) {
      return res.json({
        success: false,
        field: "password",
        message: "Password must be at least 6 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.json({
        success: false,
        field: "confirmPassword",
        message: "Passwords do not match",
      });
    }

    // Uniqueness checks
    const existingByEmail = await User.findOne({ email });
    if (existingByEmail) {
      return res.json({
        success: false,
        field: "email",
        message: "Email already exists",
      });
    }
    const existingByMobile = await User.findOne({ mobile });
    if (existingByMobile) {
      return res.json({
        success: false,
        field: "mobile",
        message: "Mobile number already exists",
      });
    }

    // Referral code validation (now only by referralCode field)
    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });
      if (!referringUser) {
        return res.json({
          success: false,
          field: "referralCode",
          message: "Invalid referral code",
        });
      }
    }

    const otp = generateOTP();
    req.session.otp = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000,
      userData: {
        fullName,
        email,
        mobile,
        password,
        referralCode,
        // identifier from referral link, if any
        referralIdentifier: req.session.referralIdentifier || null,
      },
      action: "signup",
    };

    // mark sending timestamp to prevent immediate duplicates
    req.session._otp_sending_ts = Date.now();

    req.session.save(async (err) => {
      if (err) {
        console.error("Session save error in signUp:", err);
        return res.json({
          success: false,
          message: "Failed to start verification. Please try again.",
        });
      }
      try {
        await sendOTP(email, otp);
        return res.json({ success: true, redirect: "/otp-verification" });
      } catch (sendErr) {
        console.error("Error sending OTP:", sendErr);
        return res.json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    });
  } catch (error) {
    console.error("Error in signUp:", error.message);
    return res.json({
      success: false,
      message: "Server error, try again later",
    });
  }
};

module.exports = {
  signUpPage,
  signUp,
};
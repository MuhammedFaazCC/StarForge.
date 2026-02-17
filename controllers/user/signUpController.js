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
  let { fullName, email, mobile, password, confirmPassword, referralCode } =
    req.body || {};

  try {
    // Normalize inputs
    email = email?.toLowerCase().trim();
    mobile = mobile?.trim();

    // OTP spam prevention
    const now = Date.now();
    const lastSend = req.session._otp_sending_ts || 0;
    if (now - lastSend < 4000) {
      return res.status(429).json({
        success: false,
        message: "Please wait a moment before retrying."
      });
    }

    // Full Name
    if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 50) {
      return res.status(400).json({
        success: false,
        field: "fullName",
        message: "Full name must be between 2 and 50 characters."
      });
    }

    if (!/^[A-Za-z\s]+$/.test(fullName)) {
      return res.status(400).json({
        success: false,
        field: "fullName",
        message: "Full name can contain only letters and spaces."
      });
    }

    // Email
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        field: "email",
        message: "Please provide a valid email address."
      });
    }

    // Mobile
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        field: "mobile",
        message: "Mobile number must be exactly 10 digits."
      });
    }

    // Password
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        field: "password",
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        field: "confirmPassword",
        message: "Passwords do not match."
      });
    }

    // Uniqueness checks
    if (await User.findOne({ email })) {
      return res.status(409).json({
        success: false,
        field: "email",
        message: "Email already exists."
      });
    }

    if (await User.findOne({ mobile })) {
      return res.status(409).json({
        success: false,
        field: "mobile",
        message: "Mobile number already exists."
      });
    }

    // Referral code validation
    if (referralCode) {
      const refUser = await User.findOne({
        referralCode,
        isActive: true,
        isBlocked: false
      });

      if (!refUser) {
        return res.status(400).json({
          success: false,
          field: "referralCode",
          message: "Invalid referral code."
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    req.session.otp = {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000,
      action: "signup",
      userData: {
        fullName,
        email,
        mobile,
        rawPassword: password, // explicit
        referralCode,
        referralIdentifier: req.session.referralIdentifier || null
      }
    };

    req.session._otp_sending_ts = Date.now();

    req.session.save(async (err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to start verification. Please try again."
        });
      }

      try {
        await sendOTP(email, otp);
        return res.status(200).json({
          success: true,
          redirect: "/otp-verification"
        });
      } catch (mailErr) {
        console.error("OTP send error:", mailErr);
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP. Please try again."
        });
      }
    });

  } catch (error) {
    console.error("SIGNUP SERVER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

module.exports = {
  signUpPage,
  signUp,
};
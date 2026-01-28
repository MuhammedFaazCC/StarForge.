const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const multer = require("multer");
const User = require("../../models/userSchema");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../public/uploads/profiles");
    try {
      await fs.promises.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith("image/") && allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

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

const deleteImage = async (filename) => {
  if (!filename) {return;}
  const filePath = path.join(
    __dirname,
    "../../public/uploads/profiles",
    filename
  );
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {console.error("Error deleting image:", err);}
  }
};

const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    text: `Your OTP for updating your profile is: ${otp}`,
  };
  await transporter.sendMail(mailOptions);
};

const getProfilePage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("userProfile", {
      user,
      error: req.flash("error"),
      success: req.flash("success"),
      orderCount: 0,
      wishlistCount: 0,
    });
  } catch (err) {
    console.error("Error loading profile:", err);
    res.redirect("/pageNotFound");
  }
};

const postEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/pageNotFound");
    }

    const { name, email, mobile } = req.body;
    const trimmedName = name ? name.trim() : "";
    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    const trimmedMobile = mobile ? mobile.trim() : undefined;

    if (!trimmedName || !normalizedEmail) {
      req.flash("error", "Name and email are required.");
      return res.redirect("/profile");
    }

    if (normalizedEmail === user.email) {
      // Update basic fields directly when email is unchanged
      user.fullName = trimmedName;
      user.mobile = typeof trimmedMobile === 'string' && trimmedMobile.length > 0 ? trimmedMobile : user.mobile;

      // If a new profile image is uploaded via the same form, replace it
      if (req.file) {
        if (user.profileImage) {
          await deleteImage(user.profileImage);
        }
        user.profileImage = req.file.filename;
      }

      await user.save();
      req.flash("success", "Profile updated successfully.");
      return res.redirect("/profile");
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      req.flash("error", "Email is already taken.");
      return res.redirect("/profile");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = {
      code: otp,
      email: normalizedEmail,
      expires: Date.now() + 10 * 60 * 1000,
      userData: { fullName: trimmedName, mobile: typeof trimmedMobile === 'string' && trimmedMobile.length > 0 ? trimmedMobile : user.mobile },
      action: "editProfile",
    };

    await sendOtpEmail(normalizedEmail, otp);
    req.flash("success", "OTP sent to your new email. Please verify.");
    res.redirect("/otp-verification");
  } catch (err) {
    console.error("Error updating profile:", err);
    req.flash("error", "Error updating profile.");
    res.redirect("/profile");
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.profileImage) {
      await deleteImage(user.profileImage);
    }

    user.profileImage = req.file.filename;
    await user.save();

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
};


const removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.profileImage) {
      await deleteImage(user.profileImage);
      user.profileImage = null;
      await user.save();
    }

    return res.json({ success: true, message: "Profile image removed successfully" });
  } catch (err) {
    console.error("Error removing profile image:", err);
    return res.status(500).json({ success: false, message: "Error removing profile image" });
  }
};

const getChangePasswordPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);

    if (user.googleId) {
      req.flash("error", "Password change is not available for Google accounts.");
      return res.redirect("/profile");
    }

    res.render("changePassword", {
      user: req.session.user,
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (err) {
    console.error("Error loading change password page:", err);
    res.redirect("/pageNotFound");
  }
};

const postChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.session.user._id);

    if (user.googleId) {
      req.flash("error", "Password change is not available for Google accounts.");
      return res.redirect("/profile");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      req.flash("error", "Current password is incorrect.");
      return res.redirect("/changePassword");
    }

    if (newPassword !== confirmPassword) {
      req.flash("error", "New passwords do not match.");
      return res.redirect("/changePassword");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    req.flash("success", "Password updated successfully.");
    res.redirect("/profile");
  } catch (err) {
    console.error("Error changing password:", err);
    req.flash("error", "Error changing password.");
    res.redirect("/changePassword");
  }
};

module.exports = {
  upload,
  getProfilePage,
  postEditProfile,
  uploadProfileImage,
  removeProfileImage,
  getChangePasswordPage,
  postChangePassword,
};
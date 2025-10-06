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
  if (!filename) return;
  const filePath = path.join(
    __dirname,
    "../../public/uploads/profiles",
    filename
  );
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Error deleting image:", err);
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

    if (!name || !email) {
      req.flash("error", "Name and email are required.");
      return res.redirect("/profile");
    }

    if (email === user.email) {
      user.name = name;
      user.mobile = mobile ? mobile.trim() : user.mobile;
      await user.save();
      req.flash("success", "Profile updated successfully.");
      return res.redirect("/profile");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash("error", "Email is already taken.");
      return res.redirect("/profile");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = {
      code: otp,
      email,
      expires: Date.now() + 10 * 60 * 1000,
      userData: { name, mobile: mobile ? mobile.trim() : user.mobile },
      action: "editProfile",
    };

    await sendOtpEmail(email, otp);
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
    upload.single("profileImage")(req, res, async (err) => {
      if (err) {
        req.flash("error", err.message || "Upload failed.");
        return res.redirect("/profile");
      }

      const user = await User.findById(req.session.user._id);
      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/pageNotFound");
      }

      if (user.profileImage) {
        await deleteImage(user.profileImage);
      }

      user.profileImage = req.file.filename;
      await user.save();

      req.flash("success", "Profile image updated successfully.");
      res.redirect("/profile");
    });
  } catch (err) {
    console.error("Error uploading profile image:", err);
    req.flash("error", "Error uploading profile image.");
    res.redirect("/profile");
  }
};

const removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/pageNotFound");
    }

    if (user.profileImage) {
      await deleteImage(user.profileImage);
      user.profileImage = null;
      await user.save();
    }

    req.flash("success", "Profile image removed successfully.");
    res.redirect("/profile");
  } catch (err) {
    console.error("Error removing profile image:", err);
    req.flash("error", "Error removing profile image.");
    res.redirect("/profile");
  }
};

const getChangePasswordPage = async (req, res) => {
  try {
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

    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/pageNotFound");
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
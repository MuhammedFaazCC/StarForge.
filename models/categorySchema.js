const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [50, "Category name cannot exceed 50 characters"],
      validate: {
        validator: function(v) {
          // Allow only letters, numbers, spaces, and hyphens
          return /^[a-zA-Z0-9\s\-]+$/.test(v);
        },
        message: "Category name can only contain letters, numbers, spaces, and hyphens"
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    offer: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    image: {
      type: String,
      default: "",
    },
    stock: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Create case-insensitive unique index for category name
categorySchema.index({ name: 1 }, { 
  unique: true, 
  collation: { locale: 'en', strength: 2 } 
});

module.exports = mongoose.model("Category", categorySchema);
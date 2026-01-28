import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,

  // ============================
  // Node / Express / Scripts
  // ============================
  {
    files: [
      "app.js",
      "config/**/*.js",
      "controllers/**/*.js",
      "models/**/*.js",
      "routes/**/*.js",
      "middlewares/**/*.js",
      "scripts/**/*.js",
      "util/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "eqeqeq": "error",
      "prefer-const": "error",
      "no-var": "error",
      "curly": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // ======================
  // Browser JS
  // ======================
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        Swal: "readonly",
        Chart: "readonly",
        Razorpay: "readonly",
        Cropper: "readonly",
      },
    },
  },

  // ======================
  // Ignore templates
  // ======================
  {
    ignores: ["views/**/*.ejs"],
  },

  // ======================
  // Ignore deps / uploads
  // ======================
  {
    ignores: ["node_modules/**", "uploads/**", "dist/**"],
  },
];
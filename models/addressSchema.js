const mongoose = require ("mongoose");

const addressSchema = new mongoose.Schema({
  userId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  name: {
    type: String,
    required: true,
    maxLength: 100
  },

  phone: {
    type: String,
    required: true,
    match: [/^\d{10}$/, 'Phone number must be exactly 10 digits'],
    maxLength: 10
  },

  address: {
    type: String,
    required: true,
    placeholder: "House/Flat No., Building, Street, Locality",
    maxLength: 200
  },

  district: {
    type: String,
    required: true,
    placeholder: "eg: Ernakulam",
    maxLength: 50
  },

  state: {
    type: String,
    required: true,
    placeholder: "eg: Kerala",
    maxLength: 50
  },

  city: {
    type: String,
    required: true,
    placeholder: "eg: Hospital",
    maxLength: 50
  },

  pinCode: {
    type: String,
    required: true,
    placeholder: "eg: 689230",
    match: [/^\d{6}$/, 'Pin code must be exactly 6 digits'],
    maxLength: 6
  },

  mobile: {
    type: String,
    maxLength: 15
  },

  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Address", addressSchema);
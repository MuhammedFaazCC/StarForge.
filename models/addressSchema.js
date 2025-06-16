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

  address: {
    type: String,
    required: true,
    placeholder: "House Name, House Number, Locality",
    maxLength: 255
  },

  district: {
    type: String,
    required: true,
    placeholder: "eg: Ernakulam",
    maxLength: 100
  },

  state: {
    type: String,
    required: true,
    placeholder: "eg: Kerala",
    maxLength: 100
  },

  city: {
    type: String,
    required: true,
    placeholder: "eg: Hospital",
    maxLength: 100
  },

  pinCode: {
    type: String,
    required: true,
    placeholder: "eg: 689230",
    pattern: /^\d{6}$/,
    maxLength: 6
  }
});

module.exports = mongoose.model("Address", addressSchema);
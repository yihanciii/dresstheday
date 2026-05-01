const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: String,
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  phoneNumber: String,
  dateOfBirth: String,
  defaultSize: Number,
  memberSince: Number,
  passwordHash: String,
  address: {
    street: String,
    apt: String,
    city: String,
    state: String,
    zipCode: Number
  },
  rentalHistory: { type: Array, default: [] },
  activeRentals: { type: Array, default: [] },
  returns: { type: Array, default: [] },
  wishlist: { type: Array, default: [] },
  role: { type: String, default: 'user' },
  isActive: { type: Boolean, default: true }
}, { collection: 'users' });

module.exports = mongoose.model('User', userSchema);

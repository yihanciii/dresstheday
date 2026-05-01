const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: String,
  userId: String,
  product: {
    productId: String,
    itemName: String,
    imageFilename: String,
    size: Number,
    backupSize: Number,
    rentalDays: Number,
    rentalPrice: Number,
    pricePerDay: Number
  },
  arrivalDate: Date,
  returnDate: Date,
  shippingAddress: {
    firstName: String,
    lastName: String,
    street: String,
    apt: String,
    city: String,
    state: String,
    zipCode: String
  },
  deliveryMethod: { type: String, enum: ['standard', 'express'], default: 'standard' },
  deliveryFee: { type: Number, default: 0 },
  subtotal: Number,
  tax: Number,
  total: Number,
  status: {
    type: String,
    enum: ['confirmed', 'dispatched', 'with_you', 'return_scheduled', 'returned', 'purchased'],
    default: 'confirmed'
  },
  statusTimeline: [{
    status: String,
    timestamp: Date,
    note: String
  }],
  extension: {
    extended: { type: Boolean, default: false },
    originalReturnDate: Date,
    extensionDays: Number,
    extensionFee: Number
  },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'orders' });

module.exports = mongoose.model('Order', orderSchema);

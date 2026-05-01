const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  userId: String,
  itemName: String,
  imageFilename: String,
  size: Number,
  rentalStart: Date,
  rentalEnd: Date,
  returnDueDate: Date,
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed'],
    default: 'pending'
  },
  shippingLabel: String,
  issue: String,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'returns' });

module.exports = mongoose.model('Return', returnSchema);

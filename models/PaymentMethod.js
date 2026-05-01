const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  userId:              { type: String,  required: true, index: true },
  orderId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  cardBrand:           { type: String,  default: 'Card' },   // 'Visa' | 'Mastercard' | 'Amex' | 'Discover'
  cardLast4:           { type: String,  required: true },     // last 4 digits for display
  cardName:            { type: String,  default: '' },        // name on card
  cardExpiry:          { type: String,  default: '' },        // 'MM / YY'
  cardNumberEncrypted: { type: String,  default: '' },        // raw/encrypted card number (demo only)
  createdAt:           { type: Date,    default: Date.now },
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema, 'payment_method');

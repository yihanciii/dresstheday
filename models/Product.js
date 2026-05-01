const mongoose = require('mongoose');

// Rental price formula: R(d) = 0.75 * P * (1 - e^(-0.12d))
// Min 3 days, max 30 days
function calcRentalPrice(retailPrice, days) {
  const d = Math.min(Math.max(days, 3), 30);
  return parseFloat((0.75 * retailPrice * (1 - Math.exp(-0.12 * d))).toFixed(2));
}

const productSchema = new mongoose.Schema({
  ID: String,
  'Item Name': String,
  'Scenario Category': String,
  'Sub-Category': String,
  'Clothing Type': String,
  'Size Range': String,
  'Retail Price ($)': Number,
  'Backup Size Available': String,
  'Source URL': String,
  'Brand': String,
  'Rental Price ($/day)': Number,
  'Material': String,
  'Notes / Styling': String,
  'Size & Fit': String,
  'Care Instructions': String,
  'Sustainability': String,
  'Avg Rating': Number,
  'Review Count': String,
  'Customers Say': String,
  'Location': String,
  'Age': Number,
  'Body Type': String,
  'Star Rating': Number,
  'Review Text': String,
  'Fits': String,
  'Size Rented': Number,
  'Size Normally Worn': Number,
  'Occasion': String,
  'Review ID': String,
  'Related 1 Name': String,
  'Related 1 Brand': String,
  'Related 1 Retail ($)': Number,
  'Related 2 Name': String,
  'Related 2 Brand': String,
  'Related 2 Retail ($)': Number,
  'Related 3 Name': String,
  'Related 3 Brand': String,
  'Related 3 Retail ($)': Number,
  'Related 4 Name': String,
  'Related 4 Brand': String,
  'Related 4 Retail ($)': Number,
}, { collection: 'products' });


// Export the helper so routes can use it too
productSchema.statics.calcRentalPrice = calcRentalPrice;

module.exports = mongoose.model('Product', productSchema);

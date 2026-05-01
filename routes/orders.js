const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Return = require('../models/Return');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');

// POST /api/orders — place a new order (checkout)
router.post('/', async (req, res) => {
  try {
    // Accept userId from session (cookie) OR from request body (cross-origin dev)
    const userId = req.session.userId || req.body.userId;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const { productId, size, backupSize, arrivalDate, returnDate, shippingAddress, deliveryMethod, paymentMethod } = req.body;

    if (!productId || !size || !arrivalDate || !returnDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const product = await Product.findOne({ ID: productId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const arrival = new Date(arrivalDate);
    const returnD = new Date(returnDate);
    const rentalDays = Math.round((returnD - arrival) / (1000 * 60 * 60 * 24));

    if (rentalDays < 3 || rentalDays > 30) {
      return res.status(400).json({ error: 'Rental period must be between 3 and 30 days' });
    }

    const retailPrice = product['Retail Price ($)'];
    const rentalPrice = Product.calcRentalPrice(retailPrice, rentalDays);
    const deliveryFee = deliveryMethod === 'express' ? 5.99 : 0;
    const tax = parseFloat((rentalPrice * 0.08875).toFixed(2)); // NYC tax
    const total = parseFloat((rentalPrice + deliveryFee + tax).toFixed(2));

    // Generate order number
    const count = await Order.countDocuments();
    const orderNumber = `DT-${20000 + count + 1}`;

    const order = new Order({
      orderNumber,
      userId: userId,
      product: {
        productId,
        itemName: product['Item Name'],
        imageFilename: `${product.ID}__${product['Item Name']}.png`,
        size,
        backupSize: backupSize || null,
        rentalDays,
        rentalPrice,
        pricePerDay: parseFloat((rentalPrice / rentalDays).toFixed(2))
      },
      arrivalDate: arrival,
      returnDate: returnD,
      shippingAddress,
      deliveryMethod: deliveryMethod || 'standard',
      deliveryFee,
      subtotal: rentalPrice,
      tax,
      total,
      status: 'confirmed',
      statusTimeline: [{ status: 'confirmed', timestamp: new Date(), note: 'Order placed' }]
    });

    await order.save();

    // Auto-create Return document so the Returns page shows this order immediately
    const returnDoc = new Return({
      orderId:       order._id,
      userId:        userId,
      itemName:      order.product.itemName,
      imageFilename: order.product.imageFilename,
      size:          order.product.size,
      rentalStart:   arrival,
      rentalEnd:     returnD,
      returnDueDate: returnD,
      status:        'pending',
      shippingLabel: null,
      issue:         null,
    });
    await returnDoc.save();

    // Save payment method to payment_method collection
    if (paymentMethod && paymentMethod.cardNumber) {
      const pm = new PaymentMethod({
        userId:    userId,
        orderId:   order._id,
        cardBrand: paymentMethod.cardBrand  || 'Card',
        cardLast4: paymentMethod.cardLast4  || paymentMethod.cardNumber.slice(-4),
        cardName:  paymentMethod.cardName   || '',
        cardExpiry: paymentMethod.cardExpiry || '',
        // Never store raw card number in production — encrypt or tokenize
        // Stored here for demo purposes only
        cardNumberEncrypted: paymentMethod.cardNumber,
        createdAt: new Date(),
      });
      await pm.save();
    }

    // Update user's activeRentals
    await User.findByIdAndUpdate(userId, {
      $push: { activeRentals: order._id }
    });

    res.status(201).json({ message: 'Order placed', orderNumber, orderId: order._id, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders — get all orders for logged-in user
router.get('/', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { status } = req.query; // optional filter: "active" | "completed"

    const filter = { userId: req.session.userId };
    if (status === 'active') filter.status = { $in: ['confirmed', 'dispatched', 'with_you', 'return_scheduled'] };
    if (status === 'completed') filter.status = 'returned';

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id — get single order detail
router.get('/:id', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/orders/:id/extend — extend rental period
router.patch('/:id/extend', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { extensionDays } = req.body; // 3, 5, 7, or 30

    const validDays = [3, 5, 7];
    if (!validDays.includes(extensionDays)) {
      return res.status(400).json({ error: 'Extension must be 3, 5, 7, or 30 days' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    if (order.extension.extended) return res.status(400).json({ error: 'Already extended' });

    // Extension fee: same per-day rate as original rental
    const extensionFee = parseFloat((order.product.pricePerDay * extensionDays).toFixed(2));
    const newReturnDate = new Date(order.returnDate);
    newReturnDate.setDate(newReturnDate.getDate() + extensionDays);

    order.extension = {
      extended: true,
      originalReturnDate: order.returnDate,
      extensionDays,
      extensionFee
    };
    order.returnDate = newReturnDate;
    order.total = parseFloat((order.total + extensionFee).toFixed(2));
    order.statusTimeline.push({ status: order.status, timestamp: new Date(), note: `Rental extended by ${extensionDays} days` });

    await order.save();
    res.json({ message: 'Rental extended', newReturnDate, extensionFee, newTotal: order.total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
// POST /api/orders/:id/purchase — buy the rented item
router.post('/:id/purchase', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status === 'purchased') return res.status(400).json({ error: 'Already purchased' });

    const Product = require('../models/Product');
    const product = await Product.findOne({ ID: order.product.productId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const retailPrice   = product['Retail Price ($)'];
    const purchasePrice = parseFloat((retailPrice * 0.6).toFixed(2));

    order.status = 'purchased';
    order.statusTimeline.push({
      status:    'purchased',
      timestamp: new Date(),
      note:      `Item purchased at $${purchasePrice} (60% of retail $${retailPrice})`
    });
    await order.save();

    res.json({ purchasePrice, retailPrice, message: 'Purchase confirmed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
module.exports = router;

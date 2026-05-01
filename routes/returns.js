const express = require('express');
const router = express.Router();
const Return = require('../models/Return');
const Order = require('../models/Order');
const User = require('../models/User');

// GET /api/returns — get all pending returns for logged-in user
router.get('/', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const returns = await Return.find({ userId: req.session.userId }).sort({ returnDueDate: 1 });
    res.json(returns);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/returns/:orderId/schedule — schedule a return shipping
router.post('/:orderId/schedule', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });

    // Check if return already exists
    let ret = await Return.findOne({ orderId: order._id });
    if (!ret) {
      ret = new Return({
        orderId: order._id,
        userId: req.session.userId,
        itemName: order.product.itemName,
        imageFilename: order.product.imageFilename,
        size: order.product.size,
        rentalStart: order.arrivalDate,
        rentalEnd: order.returnDate,
        returnDueDate: order.returnDate
      });
    }

    // Generate a mock shipping label
    ret.status = 'scheduled';
    ret.shippingLabel = `LABEL-${Date.now()}`;
    await ret.save();

    // Update order status
    order.status = 'return_scheduled';
    order.statusTimeline.push({ status: 'return_scheduled', timestamp: new Date(), note: 'Return shipping scheduled' });
    await order.save();

    res.json({ message: 'Return scheduled', shippingLabel: ret.shippingLabel, returnId: ret._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/returns/:id/issue — report an issue with a return item
router.patch('/:id/issue', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { issue } = req.body;
    const ret = await Return.findByIdAndUpdate(req.params.id, { issue }, { new: true });
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json({ message: 'Issue reported', ret });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/returns/:id/complete — mark return as completed
router.patch('/:id/complete', async (req, res) => {
  try {
    const ret = await Return.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    // Update order status and move to rental history
    const order = await Order.findByIdAndUpdate(ret.orderId, {
      status: 'returned',
      $push: { statusTimeline: { status: 'returned', timestamp: new Date(), note: 'Return completed' } }
    });

    if (order) {
      await User.findByIdAndUpdate(ret.userId, {
        $pull: { activeRentals: order._id },
        $push: { rentalHistory: order._id, returns: ret._id }
      });
    }

    res.json({ message: 'Return completed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

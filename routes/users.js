const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');

// POST /api/users/register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, dateOfBirth, defaultSize } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Generate next user ID
    const count = await User.countDocuments();
    const newId = `USR-${String(count + 1).padStart(4, '0')}`;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      _id: newId,
      firstName, lastName, email, passwordHash,
      phoneNumber, dateOfBirth, defaultSize,
      memberSince: new Date().getFullYear()
    });
    await user.save();

    req.session.userId = newId;
    res.status(201).json({ message: 'Registered successfully', userId: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user._id;
    res.json({ message: 'Logged in', userId: user._id, firstName: user.firstName });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

// GET /api/users/me — get current logged-in user profile
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const user = await User.findById(req.session.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me — update profile info
router.patch('/me', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const allowed = ['firstName', 'lastName', 'phoneNumber', 'dateOfBirth', 'defaultSize', 'address'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const user = await User.findByIdAndUpdate(req.session.userId, updates, { new: true }).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me/wishlist — add or remove a product from wishlist
router.patch('/me/wishlist', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { productId, action } = req.body; // action: "add" | "remove"

    const update = action === 'add'
      ? { $addToSet: { wishlist: productId } }
      : { $pull: { wishlist: productId } };

    const user = await User.findByIdAndUpdate(req.session.userId, update, { new: true }).select('wishlist');
    res.json({ wishlist: user.wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

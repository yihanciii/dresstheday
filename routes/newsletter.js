const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Simple inline schema — no need for a separate model file
const newsletterSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  consentTimestamp: { type: Date, default: Date.now }
}, { collection: 'newsletter' });

const Newsletter = mongoose.models.Newsletter || mongoose.model('Newsletter', newsletterSchema);

// POST /api/newsletter
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const existing = await Newsletter.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Already subscribed' });

    await Newsletter.create({ email });
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

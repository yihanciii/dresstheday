const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/reviews/:productId
router.get('/:productId', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const { productId } = req.params;
    const { rating, bodyType } = req.query;

    const filter = { productId };
    if (rating) filter.rating = parseInt(rating);
    if (bodyType && bodyType !== 'all') filter.bodyType = bodyType;

    const reviews = await db.collection('reviews').find(filter).toArray();

    const avgRating = reviews.length
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({ reviews, avgRating, reviewCount: reviews.length });
  } catch (err) {
    console.error('Reviews fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

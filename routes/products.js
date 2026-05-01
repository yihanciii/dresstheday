const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET /api/products
// Query params: category, subCategory, clothingType, size, minPrice, maxPrice, sort, page, limit
router.get('/', async (req, res) => {
  try {
    const {
      category, subCategory, clothingType,
      sort = 'popular', page = 1, limit = 20
    } = req.query;

    const filter = {};
    if (category) filter['Scenario Category'] = category;
    if (subCategory) filter['Sub-Category'] = subCategory;
    if (clothingType) filter['Clothing Type'] = clothingType;

    // Sort options
    let sortObj = {};
    if (sort === 'popular') sortObj = { 'Avg Rating': -1 };
    else if (sort === 'price_asc') sortObj = { 'Retail Price ($)': 1 };
    else if (sort === 'price_desc') sortObj = { 'Retail Price ($)': -1 };
    else if (sort === 'newest') sortObj = { _id: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Add image filename and base rental price (3-day minimum) to each product
    const data = products.map(p => ({
      _id: p._id,
      id: p.ID,
      name: p['Item Name'],
      scenarioCategory: p['Scenario Category'],
      subCategory: p['Sub-Category'],
      clothingType: p['Clothing Type'],
      sizeRange: p['Size Range'],
      retailPrice: p['Retail Price ($)'],
      avgRating: p['Avg Rating'],
      reviewCount: p['Review Count'],
      customersSay: p['Customers Say'],
      backupSizeAvailable: p['Backup Size Available'],
      imageUrl: p['Source URL'],
      rentalPrice3Days: Product.calcRentalPrice(p['Retail Price ($)'], 3),
    }));

    res.json({ total, page: parseInt(page), limit: parseInt(limit), products: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/categories
// Returns all unique scenario categories and their sub-categories
router.get('/categories', async (req, res) => {
  try {
    const result = await Product.aggregate([
      {
        $group: {
          _id: '$Scenario Category',
          subCategories: { $addToSet: '$Sub-Category' }
        }
      }
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/rental-price
// Calculate rental price for a given product and number of days
// Query: productId, days
router.get('/rental-price', async (req, res) => {
  try {
    const { productId, days } = req.query;
    if (!productId || !days) return res.status(400).json({ error: 'productId and days required' });

    const product = await Product.findOne({ ID: productId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const d = Math.min(Math.max(parseInt(days), 3), 30);
    const price = Product.calcRentalPrice(product['Retail Price ($)'], d);

    res.json({ productId, days: d, rentalPrice: price });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/:id
// Get single product detail by DTD ID (e.g. "DTD-0001")
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ ID: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const retailPrice = product['Retail Price ($)'];

    // Build rental price table for 3–30 days
    const rentalPriceTable = {};
    for (let d = 3; d <= 30; d++) {
      rentalPriceTable[d] = Product.calcRentalPrice(retailPrice, d);
    }

    res.json({
      _id: product._id,
      id: product.ID,
      name: product['Item Name'],
      scenarioCategory: product['Scenario Category'],
      subCategory: product['Sub-Category'],
      clothingType: product['Clothing Type'],
      sizeRange: product['Size Range'],
      retailPrice,
      backupSizeAvailable: product['Backup Size Available'],
      material: product['Material'],
      notsStyling: product['Notes / Styling'],
      sizeAndFit: product['Size & Fit'],
      careInstructions: product['Care Instructions'],
      sustainability: product['Sustainability'],
      avgRating: product['Avg Rating'],
      reviewCount: product['Review Count'],
      customersSay: product['Customers Say'],
      imageUrl: product['Source URL'],
      rentalPriceTable,
      review: {
        location: product['Location'],
        age: product['Age'],
        bodyType: product['Body Type'],
        starRating: product['Star Rating'],
        reviewText: product['Review Text'],
        fits: product['Fits'],
        sizeRented: product['Size Rented'],
        sizeNormallyWorn: product['Size Normally Worn'],
        occasion: product['Occasion'],
        reviewId: product['Review ID']
      },
      related: await Product.aggregate([
        { $match: {
            'Sub-Category': product['Sub-Category'],
            ID: { $ne: product.ID }
          }},
        { $sample: { size: 4 } },
        { $project: {
            name: '$Item Name',
            brand: '$Brand',
            retail: '$Retail Price ($)',
            imageUrl: '$Source URL',
            id: '$ID'
          }}
      ])
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

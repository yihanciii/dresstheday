require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { GridFSBucket } = require('mongodb');

const app = express();


const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:63342',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'https://dresstheday-production.up.railway.app',
  'https://dresstheday.style',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) or known localhost origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true, // ← required so session cookies are sent & received
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dresstheday_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,                // must be false for http (localhost)
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  },
}));

// Serve static files (HTML, CSS, JS, local images if any)
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// GridFS image route — must be set up after mongoose connects
// Filename format in fs.files: "DTD-0001__Rimini Velvet Dress.png"
app.get('/images/:filename', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: 'fs' });
    const filename = req.params.filename;

    const files = await db.collection('fs.files').find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set('Content-Type', 'image/png');
    const downloadStream = bucket.openDownloadStreamByName(filename);
    downloadStream.on('error', () => res.status(404).json({ error: 'Image not found' }));
    downloadStream.pipe(res);
  } catch (err) {
    console.error('Image fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/reviews', require('./routes/reviews'));

// Fallback: serve index.html for all non-API routes (for front-end routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

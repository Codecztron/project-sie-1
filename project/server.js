const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const DOMPurify = require('dompurify');

require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Rate limiting middleware for POST requests (more strict)
const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 POST requests per windowMs
  message: "Terlalu banyak permintaan POST dari IP ini, coba lagi nanti."
});

// Rate limiting middleware for GET requests (more relaxed)
const getLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 100 GET requests per windowMs
  message: "Terlalu banyak permintaan GET dari IP ini, coba lagi nanti."
});

// MongoDB connection string
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MongoDB URI is undefined. Make sure .env file is configured correctly.');
    process.exit(1); // Stop the server if URI is not present
} else {
    console.log('MongoDB URI loaded successfully');
}

const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

connectToDatabase();

// POST feedback with stricter rate limit
app.post('/feedback', postLimiter, async (req, res) => {
    try {
        const { type, feedback } = req.body;

        // Set up DOMPurify with jsdom
        const window = (new JSDOM('')).window;
        const purify = DOMPurify(window);

        // Sanitize feedback input
        const cleanFeedback = purify.sanitize(feedback);

        const collection = client.db('feedbackDB').collection('feedbacks');
        const result = await collection.insertOne({ type, feedback: cleanFeedback, createdAt: new Date() });
        res.status(201).json({ message: 'Feedback saved successfully', id: result.insertedId });
    } catch (error) {
        res.status(500).json({ message: 'Error saving feedback', error: error.message });
    }
});

// GET feedback with more relaxed rate limit
app.get('/feedback', getLimiter, async (req, res) => {
    try {
        const collection = client.db('feedbackDB').collection('feedbacks');
        const feedbacks = await collection.find()
            .sort({ createdAt: -1 }) // Sort by createdAt in descending order
            .limit(20)               // Limit to the most recent 20 entries
            .toArray();
        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving feedback', error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

require('dotenv').config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
const Joi = require('joi');

process.env.NODE_OPTIONS = "--dns-result-order=ipv4first";

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB configuration
const MONGO_URL = process.env.MONGO_URI || "mongodb+srv://my_app:thiru_123@cluster0.shvjrnd.mongodb.net/income_expense_db?retryWrites=true&w=majority";
const DB_NAME = "income_expense_db";
const COLLECTION_NAME = "transactions";

// Joi validation schema
const transactionSchema = Joi.object({
  description: Joi.string().required(),
  amount: Joi.number().required(),
  date: Joi.date().required(),
  type: Joi.string().valid('income', 'expense').required()
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// MongoDB Client
const client = new MongoClient(MONGO_URL);

// Database connection
async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit();
});

// Connect to DB
connectDB();

// Routes

// GET all transactions
app.get("/transactions", async (req, res) => {
  try {
    const db = client.db(DB_NAME);
    const transactions = await db.collection(COLLECTION_NAME).find().toArray();
    res.json(transactions);
  } catch (err) {
    console.error("❌ GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADD transaction
app.post("/transactions", async (req, res) => {
  try {
    // Validate request body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "Request body is empty" });
    }

    // Joi validation
    const { error, value } = transactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { description, amount, date, type } = value;

    const db = client.db(DB_NAME);
    const result = await db.collection(COLLECTION_NAME).insertOne({
      description,
      amount: Number(amount),
      date: new Date(date),
      type
    });

    res.status(201).json({ 
      success: true,
      insertedId: result.insertedId 
    });
  } catch (err) {
    console.error("❌ POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE transaction
app.put("/transactions/:id", async (req, res) => {
  try {
    // Validate ID
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // Validate request body
    const { error, value } = transactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { description, amount, date, type } = value;

    const db = client.db(DB_NAME);
    const result = await db.collection(COLLECTION_NAME).updateOne(
      { _id: new ObjectId(id) },
      { $set: { 
        description, 
        amount: Number(amount), 
        date: new Date(date), 
        type 
      }}
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ 
      success: true,
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error("❌ PUT error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE transaction
app.delete("/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const db = client.db(DB_NAME);
    const result = await db.collection(COLLECTION_NAME).deleteOne({ 
      _id: new ObjectId(id) 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ 
      success: true,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error("❌ DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET || "your_fallback_secret_key";

// Serve static frontend files
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "expense-tracker.html"));
});

// Middleware: Verify JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "Access denied. Token missing." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = user;
    next();
  });
}

// ---------------- USER AUTHENTICATION ROUTES ----------------

// Register Route
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    );
    res.json({ message: "User registered successfully", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Registration failed or email already exists." });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: "User not found." });

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: "Invalid password." });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- EXPENSE & ANALYTICS ROUTES ----------------

// Parse & Save Expense using Free Google Gemini API
app.post("/api/parse-expense", authenticateToken, async (req, res) => {
  const { text } = req.body;
  const userId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Today's date is ${today}. Extract a single expense from: "${text}"
Respond with ONLY raw JSON (no markdown formatting, no backticks, no extra text):
{
  "amount": <number>,
  "category": <one of: Food, Groceries, Transport, Shopping, Bills, Entertainment, Health, Other>,
  "description": <short text>,
  "date": <YYYY-MM-DD>
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return res.status(500).json({ error: data.error?.message || "Gemini API Error." });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    await pool.query(
      "INSERT INTO expenses (user_id, amount, category, description, date) VALUES ($1, $2, $3, $4, $5)",
      [userId, parsed.amount, parsed.category, parsed.description, parsed.date]
    );

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Monthly Summary (Scoped to logged-in user)
app.get("/api/expenses/monthly-summary", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_spent 
      FROM expenses 
      WHERE user_id = $1 AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Category Breakdown (Scoped to logged-in user)
app.get("/api/expenses/category-breakdown", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, SUM(amount) AS total 
      FROM expenses 
      WHERE user_id = $1 AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY category 
      ORDER BY total DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
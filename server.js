const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Test route - just to check if server is running
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running!" });
});

// Main route: Parse expense with AI
app.post("/api/parse-expense", async (req, res) => {
  const { text } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  
  // Create the prompt for Claude
  const prompt = `Today's date is ${today}. Extract a single expense from: "${text}"
Respond with ONLY raw JSON (no markdown, no extra text):
{
  "amount": <number>,
  "category": <one of: Food, Groceries, Transport, Shopping, Bills, Entertainment, Health, Other>,
  "description": <short text>,
  "date": <YYYY-MM-DD>
}`;

  try {
    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
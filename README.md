# 🎙️ AI Voice Expense Tracker

A multi-tenant, zero-cost web application that parses spoken voice inputs into categorized expense logs using Google Gemini AI.

## 🚀 Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (Web Speech API)
- **Backend**: Node.js, Express.js
- **Database**: Neon PostgreSQL (Isolated per `user_id`)
- **Authentication**: JWT & bcrypt
- **AI Model**: Google Gemini API (`gemini-3.6-flash`)

## ✨ Key Features
- **Voice Parsing**: Automatically extracts amount, category, and date from speech.
- **Data Security**: Secure login/registration with multi-tenant database isolation.
- **Zero Cost**: Built entirely on free-tier cloud infrastructure.

## 🔑 Environment Variables
`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`
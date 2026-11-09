require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(x => x.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Allow tools such as Postman (no Origin header) and configured website origins.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '20kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'finindia24x7',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'FinIndia24x7 API and database are connected.' });
  } catch (error) {
    console.error('Health check database error:', error.message);
    res.status(503).json({ success: false, message: 'API is running but database is unavailable.' });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const { fullName, phone, email, productType, monthlyIncome, city, message, consent } = req.body || {};
    const name = typeof fullName === 'string' ? fullName.trim() : '';
    const mobile = typeof phone === 'string' ? phone.trim() : '';
    const product = typeof productType === 'string' ? productType.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';

    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({ success: false, message: 'Please enter your full name (2–120 characters).' });
    }
    if (!/^\+?[0-9\s-]{10,16}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });
    }
    if (cleanEmail && (cleanEmail.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    const products = ['Personal Loan','Business Loan','Home Loan','Loan Against Property','Credit Card','Gold Loan','Health Insurance','Vehicle Insurance','Other'];
    if (!products.includes(product)) return res.status(400).json({ success: false, message: 'Please select a valid product.' });
    if (consent !== true) return res.status(400).json({ success: false, message: 'Consent is required to submit this enquiry.' });

    let income = null;
    if (monthlyIncome !== undefined && monthlyIncome !== null && monthlyIncome !== '') {
      income = Number(monthlyIncome);
      if (!Number.isFinite(income) || income < 0 || income > 9999999999) {
        return res.status(400).json({ success: false, message: 'Please enter a valid monthly income.' });
      }
    }
    const safeCity = typeof city === 'string' ? city.trim().slice(0, 100) : null;
    const safeMessage = typeof message === 'string' ? message.trim().slice(0, 2000) : null;

    const [result] = await pool.execute(
      `INSERT INTO customer_leads
       (full_name, phone, email, product_type, monthly_income, city, message, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile, cleanEmail || null, product, income, safeCity || null, safeMessage || null, 1]
    );
    return res.status(201).json({
    success: true,
    message: 'Thank you! Your enquiry has been submitted successfully.',
    leadId: result.insertId
});
  } catch (error) {
    console.error('Lead submission error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save your enquiry right now. Please try again later.' });
  }
});

// Private endpoint: send x-admin-api-key from a trusted admin tool only. Never put this key in frontend code.
app.get('/api/admin/leads', async (req, res) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey || configuredKey === 'replace-this-with-a-long-random-secret') {
    return res.status(503).json({ success: false, message: 'Admin API key is not configured on the server.' });
  }
  if (req.get('x-admin-api-key') !== configuredKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, phone, email, product_type AS productType,
       monthly_income AS monthlyIncome, city, message, status, created_at AS createdAt
       FROM customer_leads ORDER BY created_at DESC LIMIT ?`, [limit]
    );
    res.json({ success: true, count: rows.length, leads: rows });
  } catch (error) {
    console.error('Admin leads error:', error.message);
    res.status(500).json({ success: false, message: 'Unable to retrieve enquiries.' });
  }
});

app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => {
  console.error('Request error:', err.message);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connection successful.');
  } catch (error) {
    console.error('Could not connect to MySQL:', error.message);
    console.error('Start MySQL in XAMPP and check backend/.env settings.');
  }
  app.listen(PORT, () => console.log(`FinIndia24x7 API listening at http://localhost:${PORT}`));
}
start();

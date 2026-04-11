require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { initDB } = require('./models/database');

const authRoutes = require('./routes/auth');
const shopifyRoutes = require('./routes/shopify');
const inventoryRoutes = require('./routes/inventory');
const vendorRoutes = require('./routes/vendors');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const quoteRoutes = require('./routes/quotes');
const rmaRoutes = require('./routes/rma');
const bomRoutes = require('./routes/bom');
const manufacturingRoutes = require('./routes/manufacturing');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'stockcentral-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/rma', rmaRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/manufacturing', manufacturingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', app: 'StockCentral' }));

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`StockCentral backend running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

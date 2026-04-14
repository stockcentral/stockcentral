const express = require('express');
const cors = require('cors');
const { initDB, pool } = require('./models/database');

const authRouter = require('./routes/auth');
const inventoryRouter = require('./routes/inventory');
const vendorsRouter = require('./routes/vendors');
const purchaseOrdersRouter = require('./routes/purchaseOrders');
const quotesRouter = require('./routes/quotes');
const shopifyRouter = require('./routes/shopify');
const emailRouter = require('./routes/email');
const settingsRouter = require('./routes/settings');
const ordersRouter = require('./routes/orders');
const { rmaRouter, bomRouter, mfgRouter, invoiceRouter, paymentRouter } = require('./routes/operations');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', app: 'StockCentral' }));

// Seed endpoint — inserts sample data for testing
app.post('/seed', async (req, res) => {
      try {
              const { secret } = req.body;
              if (secret !== 'seed-stockcentral-2024') return res.status(403).json({ error: 'Forbidden' });

        const statusRes = await pool.query('SELECT id FROM order_statuses WHERE is_default=true LIMIT 1');
              const paidStatusId = statusRes.rows[0]?.id || null;

        // Sample inventory
        const items = [
            { sku:'GPU-FAN-01', name:'GPU Cooling Fan Assembly', cost:42.00, price:89.99, quantity:24, category:'Cooling', is_manufactured:false },
            { sku:'THERM-10G', name:'Thermal Paste Pro 10g', cost:4.50, price:12.99, quantity:87, category:'Thermal', is_manufactured:false },
            { sku:'PCIE-RSR-60', name:'PCIe Riser Cable 60cm', cost:110.00, price:234.00, quantity:12, category:'Cables', is_manufactured:false },
            { sku:'GPU-ASSM-3080', name:'Custom GPU Assembly 3080', cost:680.00, price:1199.99, quantity:5, category:'GPUs', is_manufactured:true },
            { sku:'FAN-120MM', name:'120mm Case Fan', cost:8.00, price:19.99, quantity:150, category:'Cooling', is_manufactured:false },
                ];
              for (const item of items) {
                        await pool.query(
                                    `INSERT INTO inventory_items (sku,name,cost,price,quantity,low_stock_threshold,category,is_manufactured)
                                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (sku) DO NOTHING`,
                                    [item.sku,item.name,item.cost,item.price,item.quantity,10,item.category,item.is_manufactured]
                                  );
              }

        // Sample orders with realistic financial breakdowns
        const orders = [
            {
                        shopify_order_id:'SAMPLE-1001', order_number:'1001',
                        customer_name:'James Rivera', customer_email:'james.rivera@example.com',
                        subtotal_price:390.94, total_shipping_price:18.99, total_tax:20.04, total_price:429.97,
                        line_items:[
                            { name:'GPU Cooling Fan Assembly', sku:'GPU-FAN-01', quantity:2, price:89.99 },
                            { name:'Thermal Paste Pro 10g', sku:'THERM-10G', quantity:3, price:12.99 },
                            { name:'PCIe Riser Cable 60cm', sku:'PCIE-RSR-60', quantity:1, price:234.00 },
                                    ]
            },
            {
                        shopify_order_id:'SAMPLE-1002', order_number:'1002',
                        customer_name:'Sarah Chen', customer_email:'sarah.chen@example.com',
                        subtotal_price:1119.98, total_shipping_price:29.99, total_tax:70.01, total_price:1219.98,
                        line_items:[
                            { name:'Custom GPU Assembly 3080', sku:'GPU-ASSM-3080', quantity:1, price:1199.99 },
                            { name:'Thermal Paste Pro 10g', sku:'THERM-10G', quantity:1, price:12.99 },
                            { name:'120mm Case Fan', sku:'FAN-120MM', quantity:1, price:19.99 },
                                    ]
            },
            {
                        shopify_order_id:'SAMPLE-1003', order_number:'1003',
                        customer_name:'Marcus Thompson', customer_email:'m.thompson@example.com',
                        subtotal_price:159.96, total_shipping_price:9.99, total_tax:9.99, total_price:179.94,
                        line_items:[
                            { name:'120mm Case Fan', sku:'FAN-120MM', quantity:6, price:19.99 },
                            { name:'GPU Cooling Fan Assembly', sku:'GPU-FAN-01', quantity:1, price:89.99 },
                                    ]
            }
                ];

        let inserted = 0;
              for (const order of orders) {
                        // Upsert — update financial fields if order already exists
                await pool.query(
                            `INSERT INTO shopify_orders
                                       (shopify_order_id,order_number,customer_name,customer_email,
                                                   total_price,subtotal_price,total_shipping_price,total_tax,
                                                               line_items,status,custom_status_id)
                                                                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                                                                                 ON CONFLICT (shopify_order_id) DO UPDATE SET
                                                                                            subtotal_price=EXCLUDED.subtotal_price,
                                                                                                       total_shipping_price=EXCLUDED.total_shipping_price,
                                                                                                                  total_tax=EXCLUDED.total_tax,
                                                                                                                             updated_at=NOW()`,
                            [order.shopify_order_id,order.order_number,order.customer_name,order.customer_email,
                                      order.total_price,order.subtotal_price,order.total_shipping_price,order.total_tax,
                                      JSON.stringify(order.line_items),'paid_unfulfilled',paidStatusId]
                          );
                        inserted++;
              }

        res.json({ success:true, message:`Seeded ${inserted} orders and ${items.length} inventory items` });
      } catch(err) {
              console.error('Seed error:', err);
              res.status(500).json({ error: err.message });
      }
});

app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/shopify', shopifyRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/rma', rmaRouter);
app.use('/api/bom', bomRouter);
app.use('/api/manufacturing', mfgRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/email', emailRouter);

app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: err.message });
});

initDB().then(() => {
      app.listen(PORT, () => console.log(`StockCentral running on port ${PORT}`));
}).catch(err => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
});

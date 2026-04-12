const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
    try {
          const result = await pool.query('SELECT * FROM vendors ORDER BY name ASC');
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
    try {
          const result = await pool.query('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
          if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    try {
          const { name, company_name, email, phone, address, website, notes, sales_rep_name, sales_rep_email, sales_rep_phone } = req.body;
          if (!name) return res.status(400).json({ error: 'Vendor name is required' });
          const result = await pool.query(
                  'INSERT INTO vendors (name, company_name, email, phone, address, website, notes, sales_rep_name, sales_rep_email, sales_rep_phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
                  [name, company_name||null, email||null, phone||null, address||null, website||null, notes||null, sales_rep_name||null, sales_rep_email||null, sales_rep_phone||null]
                );
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
    try {
          const { name, company_name, email, phone, address, website, notes, sales_rep_name, sales_rep_email, sales_rep_phone } = req.body;
          const result = await pool.query(
                  'UPDATE vendors SET name=$1, company_name=$2, email=$3, phone=$4, address=$5, website=$6, notes=$7, sales_rep_name=$8, sales_rep_email=$9, sales_rep_phone=$10, updated_at=NOW() WHERE id=$11 RETURNING *',
                  [name, company_name||null, email||null, phone||null, address||null, website||null, notes||null, sales_rep_name||null, sales_rep_email||null, sales_rep_phone||null, req.params.id]
                );
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
          await pool.query('DELETE FROM vendors WHERE id=$1', [req.params.id]);
          res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/import', async (req, res) => {
    try {
          const { vendors, source } = req.body;
          let imported = 0, skipped = 0;
          for (const v of vendors) {
                  if (!v.name) { skipped++; continue; }
                  await pool.query(
                            'INSERT INTO vendors (name, company_name, email, phone, sales_rep_name, sales_rep_email, sales_rep_phone) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (name) DO UPDATE SET company_name=EXCLUDED.company_name, email=EXCLUDED.email, phone=EXCLUDED.phone, updated_at=NOW()',
                            [v.name, v.company_name||null, v.email||null, v.phone||null, v.sales_rep_name||null, v.sales_rep_email||null, v.sales_rep_phone||null]
                          );
                  imported++;
          }
          res.json({ imported, skipped, message: `Imported ${imported} vendors from ${source}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

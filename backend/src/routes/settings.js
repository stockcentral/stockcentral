const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

router.get('/:key', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM app_settings WHERE key=$1', [req.params.key]);
          res.json(result.rows[0] || { key: req.params.key, value: null });
            } catch (err) { res.status(500).json({ error: err.message }); }
            });

            router.post('/', async (req, res) => {
              try {
                  const { key, value } = req.body;
                      const result = await pool.query(
                            'INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW() RETURNING *',
                                  [key, JSON.stringify(value)]
                                      );
                                          res.json(result.rows[0]);
                                            } catch (err) { res.status(500).json({ error: err.message }); }
                                            });

                                            router.get('/ticket-types/all', async (req, res) => {
                                              try {
                                                  const result = await pool.query('SELECT * FROM ticket_types ORDER BY name ASC');
                                                      res.json(result.rows);
                                                        } catch (err) { res.status(500).json({ error: err.message }); }
                                                        });

                                                        router.post('/ticket-types', async (req, res) => {
                                                          try {
                                                              const { name, color } = req.body;
                                                                  const result = await pool.query(
                                                                        'INSERT INTO ticket_types (name, color) VALUES ($1,$2) RETURNING *',
                                                                              [name, color || '#6366f1']
                                                                                  );
                                                                                      res.json(result.rows[0]);
                                                                                        } catch (err) { res.status(500).json({ error: err.message }); }
                                                                                        });

                                                                                        router.put('/ticket-types/:id', async (req, res) => {
                                                                                          try {
                                                                                              const { name, color } = req.body;
                                                                                                  const result = await pool.query(
                                                                                                        'UPDATE ticket_types SET name=$1, color=$2 WHERE id=$3 RETURNING *',
                                                                                                              [name, color, req.params.id]
                                                                                                                  );
                                                                                                                      res.json(result.rows[0]);
                                                                                                                        } catch (err) { res.status(500).json({ error: err.message }); }
                                                                                                                        });
                                                                                                                        
                                                                                                                        router.delete('/ticket-types/:id', async (req, res) => {
                                                                                                                          try {
                                                                                                                              await pool.query('DELETE FROM ticket_types WHERE id=$1', [req.params.id]);
                                                                                                                                  res.json({ success: true });
                                                                                                                                    } catch (err) { res.status(500).json({ error: err.message }); }
                                                                                                                                    });
                                                                                                                                    
                                                                                                                                    module.exports = router;

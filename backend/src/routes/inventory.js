const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

const sanitize = (val, type) => {
      if (val === undefined || val === null || val === '') return null;
      if (type === 'numeric') { const n = parseFloat(String(val).replace(/[^0-9.-]/g,'')); return isNaN(n)?null:n; }
      if (type === 'int') { const n = parseInt(String(val).replace(/[^0-9]/g,'')); return isNaN(n)?null:n; }
      return String(val).trim();
};

const validateItem = (body) => {
      const errors = [];
      if (!body.sku||!String(body.sku).trim()) errors.push({field:'sku',message:'SKU is required (letters, numbers, spaces allowed)'});
      if (!body.name||!String(body.name).trim()) errors.push({field:'name',message:'Item name is required'});
      if (body.cost!==undefined&&body.cost!==''&&body.cost!==null&&isNaN(parseFloat(body.cost))) errors.push({field:'cost',message:'Cost must be a valid number'});
      if (body.price!==undefined&&body.price!==''&&body.price!==null&&isNaN(parseFloat(body.price))) errors.push({field:'price',message:'Price must be a valid number'});
      if (body.quantity!==undefined&&body.quantity!==''&&body.quantity!==null&&isNaN(parseInt(body.quantity))) errors.push({field:'quantity',message:'Quantity must be a whole number'});
      return errors;
};

router.get('/', async (req, res) => {
      try {
              const { search, category, low_stock, manufactured } = req.query;
              let query = 'SELECT * FROM inventory_items WHERE 1=1';
              const params = [];
              if (search) { params.push(`%${search}%`); query += ` AND (sku ILIKE $${params.length} OR name ILIKE $${params.length})`; }
              if (category) { params.push(category); query += ` AND category=$${params.length}`; }
              if (low_stock==='true') query += ' AND quantity<=low_stock_threshold';
              if (manufactured==='true') query += ' AND is_manufactured=true';
              query += ' ORDER BY name ASC';
              const result = await pool.query(query, params);
              res.json(result.rows);
      } catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/:id', async (req, res) => {
      try {
              const result = await pool.query('SELECT * FROM inventory_items WHERE id=$1', [req.params.id]);
              if (!result.rows.length) return res.status(404).json({error:'Not found'});
              res.json(result.rows[0]);
      } catch(err) { res.status(500).json({error:err.message}); }
});

router.post('/import', async (req, res) => {
      try {
              const {items,source} = req.body;
              let imported=0, skipped=0;
              for (const item of items) {
                        if (!item.sku||!item.name){skipped++;continue;}
                        await pool.query(
                                    'INSERT INTO inventory_items (sku,name,description,cost,price,quantity,category,brand,weight,harmonized_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name,cost=EXCLUDED.cost,price=EXCLUDED.price,quantity=EXCLUDED.quantity,updated_at=NOW()',
                                    [String(item.sku).trim(),item.name,item.description||'',sanitize(item.cost,'numeric')||0,sanitize(item.price,'numeric')||0,sanitize(item.quantity,'int')||0,item.category||null,item.brand||null,sanitize(item.weight,'numeric'),item.harmonized_code||null]
                                  );
                        imported++;
              }
              res.json({imported,skipped,message:`Imported ${imported}, skipped ${skipped}`});
      } catch(err) { res.status(500).json({error:err.message}); }
});

router.put('/bulk/update', async (req, res) => {
      try {
              const {ids,weight,harmonized_code,length,width,height,is_manufactured} = req.body;
              if (!ids||!ids.length) return res.status(400).json({error:'No items selected'});
              const updates=[]; const params=[]; let i=1;
              if (weight!==undefined){updates.push(`weight=$${i++}`);params.push(sanitize(weight,'numeric'));}
              if (harmonized_code!==undefined){updates.push(`harmonized_code=$${i++}`);params.push(harmonized_code);}
              if (length!==undefined){updates.push(`length=$${i++}`);params.push(sanitize(length,'numeric'));}
              if (width!==undefined){updates.push(`width=$${i++}`);params.push(sanitize(width,'numeric'));}
              if (height!==undefined){updates.push(`height=$${i++}`);params.push(sanitize(height,'numeric'));}
              if (is_manufactured!==undefined){updates.push(`is_manufactured=$${i++}`);params.push(is_manufactured);}
              if (!updates.length) return res.status(400).json({error:'No fields to update'});
              updates.push('updated_at=NOW()'); params.push(ids);
              const result = await pool.query(`UPDATE inventory_items SET ${updates.join(',')} WHERE id=ANY($${i}) RETURNING id`,params);
              res.json({updated:result.rowCount});
      } catch(err) { res.status(500).json({error:err.message}); }
});

router.post('/', async (req, res) => {
      try {
              const errors = validateItem(req.body);
              if (errors.length) return res.status(400).json({errors,error:errors[0].message});
              const {sku,name,description,cost,price,quantity,low_stock_threshold,category,brand,weight,shopify_product_id,shopify_variant_id,harmonized_code,length,width,height,photo_url,country_of_origin,product_type,tags,collection,is_manufactured} = req.body;
              const result = await pool.query(
                        'INSERT INTO inventory_items (sku,name,description,cost,price,quantity,low_stock_threshold,category,brand,weight,shopify_product_id,shopify_variant_id,harmonized_code,length,width,height,photo_url,country_of_origin,product_type,tags,collection,is_manufactured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *',
                        [String(sku).trim(),String(name).trim(),description||'',sanitize(cost,'numeric'),sanitize(price,'numeric'),sanitize(quantity,'int')||0,sanitize(low_stock_threshold,'int')||5,category||null,brand||null,sanitize(weight,'numeric'),shopify_product_id||null,shopify_variant_id||null,harmonized_code||null,sanitize(length,'numeric'),sanitize(width,'numeric'),sanitize(height,'numeric'),photo_url||null,country_of_origin||null,product_type||null,tags||null,collection||null,is_manufactured||false]
                      );
              res.json(result.rows[0]);
      } catch(err) {
              if (err.code==='23505') return res.status(400).json({errors:[{field:'sku',message:'SKU already exists'}],error:'SKU already exists'});
              res.status(500).json({error:err.message});
      }
});

router.put('/:id', async (req, res) => {
      try {
              const errors = validateItem(req.body);
              if (errors.length) return res.status(400).json({errors,error:errors[0].message});
              const {sku,name,description,cost,price,quantity,low_stock_threshold,category,brand,weight,harmonized_code,length,width,height,photo_url,country_of_origin,product_type,tags,collection,is_manufactured} = req.body;
              const result = await pool.query(
                        'UPDATE inventory_items SET sku=$1,name=$2,description=$3,cost=$4,price=$5,quantity=$6,low_stock_threshold=$7,category=$8,brand=$9,weight=$10,harmonized_code=$11,length=$12,width=$13,height=$14,photo_url=$15,country_of_origin=$16,product_type=$17,tags=$18,collection=$19,is_manufactured=$20,updated_at=NOW() WHERE id=$21 RETURNING *',
                        [String(sku).trim(),String(name).trim(),description||'',sanitize(cost,'numeric'),sanitize(price,'numeric'),sanitize(quantity,'int')||0,sanitize(low_stock_threshold,'int')||5,category||null,brand||null,sanitize(weight,'numeric'),harmonized_code||null,sanitize(length,'numeric'),sanitize(width,'numeric'),sanitize(height,'numeric'),photo_url||null,country_of_origin||null,product_type||null,tags||null,collection||null,is_manufactured||false,req.params.id]
                      );
              res.json(result.rows[0]);
      } catch(err) { res.status(500).json({error:err.message}); }
});

router.delete('/:id', async (req, res) => {
      try {
              await pool.query('DELETE FROM inventory_items WHERE id=$1',[req.params.id]);
              res.json({success:true});
      } catch(err) { res.status(500).json({error:err.message}); }
});

module.exports = router;

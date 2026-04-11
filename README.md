# StockCentral ERP
### Full-stack ERP system for Shopify merchants

Built by Apex Property Ventures · Powered by StockCentral

---

## Features
- **Inventory Management** — SKUs, costs, quantities with Shopify sync
- **Vendor Management** — vendor profiles, contacts, vendor SKU mapping
- **Quote Requests → Purchase Orders** — full procurement workflow
- **PO Billing** — invoices, multi-payment recording (ACH/Check/CC/Wire)
- **RMA** — returns linked to POs and Shopify orders
- **Bill of Materials** — component definitions for finished products
- **Manufacturing Orders** — build orders with inventory deduction
- **Order History** — Shopify sync + WooCommerce/Odoo import
- **Shopify Sync** — real-time inventory and cost updates

---

## Deployment Guide (Railway + GitHub)

### Step 1 — Create GitHub Account & Repository

1. Go to **github.com** and click **Sign up**
2. Create a free account
3. Once logged in, click the **+** icon top right → **New repository**
4. Name it `stockcentral`
5. Set to **Private**
6. Click **Create repository**

### Step 2 — Upload Files to GitHub

**Option A — GitHub Desktop (easiest):**
1. Download GitHub Desktop at **desktop.github.com**
2. Sign in with your GitHub account
3. Clone your new repository to your computer
4. Copy all StockCentral files into that folder
5. Click **Commit to main** then **Push origin**

**Option B — GitHub Web Upload:**
1. Open your repository on github.com
2. Click **Add file** → **Upload files**
3. Drag and drop the entire `stockcentral` folder
4. Click **Commit changes**

### Step 3 — Create Railway Account

1. Go to **railway.app**
2. Click **Login** → **Login with GitHub**
3. Authorize Railway to access your GitHub
4. You now have a free Railway account

### Step 4 — Deploy the Backend

1. In Railway dashboard click **New Project**
2. Click **Deploy from GitHub repo**
3. Select your `stockcentral` repository
4. When asked which folder, select **backend**
5. Railway will auto-detect Node.js and start building

### Step 5 — Add PostgreSQL Database

1. In your Railway project, click **New** → **Database** → **Add PostgreSQL**
2. Railway automatically creates the database and sets `DATABASE_URL`
3. The app will connect automatically — no configuration needed

### Step 6 — Set Environment Variables (Backend)

In Railway, click your backend service → **Variables** tab → Add:

```
NODE_ENV=production
JWT_SECRET=pick-any-long-random-string-here
SESSION_SECRET=pick-any-different-long-random-string
FRONTEND_URL=https://your-frontend-url.railway.app
```

### Step 7 — Deploy the Frontend

1. In Railway, click **New** → **Deploy from GitHub repo**
2. Select `stockcentral` repository again
3. This time select **frontend** folder
4. Set these environment variables:
```
REACT_APP_API_URL=https://your-backend-url.railway.app/api
```
5. Replace `your-backend-url` with the actual URL Railway gives your backend

### Step 8 — Update FRONTEND_URL in Backend

1. Once frontend is deployed, copy its Railway URL
2. Go back to backend service → Variables
3. Update `FRONTEND_URL` to your actual frontend URL
4. Railway will auto-redeploy

### Step 9 — Create Your Admin Account

1. Open your frontend URL in the browser
2. You'll see the StockCentral login page
3. Click **Create Account** tab
4. Enter your name, email, and password
5. You're in!

### Step 10 — Connect Shopify

1. In StockCentral, go to **Settings**
2. Enter your Shopify store domain: `powergpu.myshopify.com`
3. Enter your Shopify Admin API access token
4. Click **Save Settings** then **Test & Sync Products**

---

## Getting Your Shopify Access Token

1. Go to **Shopify Admin → Settings → Apps and sales channels**
2. Click **Develop apps** at the top right
3. Click **Create an app**
4. Name it `StockCentral`
5. Click **Configure Admin API scopes**
6. Enable these scopes:
   - `read_products`, `write_products`
   - `read_inventory`, `write_inventory`
   - `read_orders`
7. Click **Save** then **Install app**
8. Click **Reveal token once** and copy it immediately
9. Paste into StockCentral Settings

---

## Monthly Costs

| Service | Cost |
|---------|------|
| Railway Hobby Plan | ~$5/month |
| PostgreSQL on Railway | Included |
| Total | ~$5/month |

---

## Support

Contact: support@powergpu.com

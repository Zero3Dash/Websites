✨ What It Does
    Create templates – Write any text (configs, scripts, letters, etc.) and mark placeholders as {{variable name}}.
    Save & reuse – Templates are saved in your browser’s local storage. You can load, edit, or delete them anytime.
    Fill & generate – Each template automatically generates a form with fields for all variables. Fill them in and click to see the completed output.
    Share via link – Generate a shareable URL that includes the template ID and any pre‑filled values. Anyone with that link will see the same template and values.
    Embed – Copy ready‑to‑use `<iframe>` snippets to embed the tool (with the current template) on another website.

🚀 How to Use
    Open the HTML file in any modern browser (Chrome, Firefox, Edge, Safari).
    Create a new template:
        In the “Create new template” box, type your text with variables in {{...}}.
        Click “Save as new template” and give it a name.
    Load a saved template:
        Choose a template from the dropdown and click “Load”.
    Fill in the values:
        The form below the template updates automatically. Enter your values.
        Click “Generate Filled Template” to see the result.
    Share:
        Click “Copy shareable link” to get a URL that loads this template and pre‑fills the current values.
        Use the embed codes at the bottom to place the tool on another page.

🧠 Technical Notes
    No server – Everything runs in your browser. Templates are saved in localStorage and never leave your machine.
    Share links – They contain the template ID and form values as URL query parameters. Opening such a link restores the exact state.
    Default template – A router configuration snippet is provided as an example, matching the original 4peg.com.
    Syntax – Variables use {{...}} (you can put spaces inside, e.g. {{IP Address}}).

📜 Background
The original 4peg.com was a simple tool for sharing templated text, popular among network engineers and script writers.
This replica aims to preserve that idea while adding modern conveniences like persistent storage and easy sharing.
It’s a static HTML file – you can host it anywhere or just run it locally.

🛠️ Files
index.html – The complete application (all CSS and JavaScript are embedded).

📄 License
Feel free to use, modify, and share this code. No attribution required.

# Complete Deployment Guide: configlab with PostgreSQL on Ubuntu 24.04

This guide provides **step‑by‑step instructions** to deploy the **configlab** web application (a template creation and sharing tool inspired by [4peg.com](https://4peg.com)) on Ubuntu 24.04 with a PostgreSQL database. The application is production‑ready, using PM2 for process management and Nginx as a reverse proxy with SSL using either from Let’s Encrypt or Self-Signed Certificates.

All commands are written to be copy‑pasted. **Always replace** placeholders like `yourdomain.com`, `YourStrongPasswordHere2026`, and `youruser` with your actual values.

## 📋 Prerequisites

* A server running **Ubuntu 24.04** (min. 1 GB RAM, 10 GB disk)
* A domain name (e.g., `configlab.yourdomain.com`) pointing to the server’s public/internal private IP address.
* SSH access with **sudo** privileges
* Basic familiarity with the terminal

## 📦 System Overview

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Browser/User  │ ───► │ Nginx (443)  │ ───► │ Node.js (3000)  │
└─────────────────┘      │ Reverse Proxy│      │ Express Server  │
                         └──────────────┘      └────────┬────────┘
                                                        │
                                                 ┌──────▼──────┐
                                                 │ PostgreSQL  │
                                                 │  (Database) │
                                                 └─────────────┘
```

## 🔧 Step 1: System Preparation

**Connect to your server** via SSH:

```
ssh youruser@your-server-ip
```

Now run the following commands **as your regular user** (with sudo):

```
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git ufw build-essential

# Configure firewall: allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Enable the firewall (confirm when prompted)
sudo ufw enable
```

## 🐘 Step 2: Install and Configure PostgreSQL 17

We’ll install PostgreSQL from the official PostgreSQL repository.

### 2.1 Add PostgreSQL Official Repository

```
# Import the repository signing key
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc

# Add the repository for Ubuntu 24.04 (Noble)
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Update package list
sudo apt update
```

### 2.2 Install PostgreSQL 17

```
sudo apt install -y postgresql-17 postgresql-client-17
```

### 2.3 Verify Installation and Enable Autostart

```
# Check service status
sudo systemctl status postgresql

# Enable to start on boot (usually already enabled)
sudo systemctl enable postgresql
```

### 2.4 Create Database and User

Switch to the `postgres` system user:

```
sudo -i -u postgres
```

Now launch the PostgreSQL interactive terminal:

```
psql
```

Execute the following SQL commands  **inside the psql prompt** :

```
-- Create the application database
CREATE DATABASE configlab_db;

-- Create the application user with a strong password
CREATE USER configlab_user WITH PASSWORD 'YourStrongPasswordHere2026';

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE configlab_db TO configlab_user;

-- Connect to the new database
\c configlab_db

-- Grant schema privileges (so the user can create tables)
GRANT ALL ON SCHEMA public TO configlab_user;

-- Exit psql
\q
```

Now exit the `postgres` user session:

```
exit
```

### 2.5 Configure PostgreSQL for Production (Optional but Recommended)

Edit the main configuration file:

```
sudo nano /etc/postgresql/17/main/postgresql.conf
```

Look for and adjust the following settings (uncomment and change values as needed):

```
# Connection settings
listen_addresses = 'localhost'          # only accept local connections
port = 5432

# Memory settings (adjust based on your server’s RAM)
shared_buffers = 256MB                  # 25% of RAM if dedicated DB server
work_mem = 8MB
maintenance_work_mem = 64MB
effective_cache_size = 768MB
```

Save and close the file (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 2.6 Configure Client Authentication

Edit the `pg_hba.conf` file:

```
sudo nano /etc/postgresql/17/main/pg_hba.conf
```

Ensure these lines are present (they usually are by default). They restrict connections to local users only.

```
# local connections
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

Save and exit.

### 2.7 Restart PostgreSQL

```
sudo systemctl restart postgresql
```

### 2.8 Test the Database Connection

```
psql -h localhost -U configlab_user -d configlab_db -W
```

Enter the password you set earlier. If successful, you’ll see the `configlab_db=>` prompt. Type `\q` to quit.

## 📁 Step 3: Create Application Directory and Database Schema

### 3.1 Create the Application Directory

We’ll place the application in `/var/www/configlab`. Run these commands **from your home directory or any location** – they use absolute paths.

```
sudo mkdir -p /var/www/configlab
sudo chown $USER:$USER /var/www/configlab
cd /var/www/configlab
```

From now on, **we are inside `/var/www/configlab`** unless stated otherwise.

### 3.2 Create the Database Schema File

Create a file named `schema.sql`:

```
nano schema.sql
```

Paste the following SQL (it creates the `templates` table and a trigger to automatically update `updated_at`):

```
-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    template_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for faster lookups by template_id
CREATE INDEX idx_template_id ON templates(template_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function on update
CREATE TRIGGER update_templates_updated_at 
    BEFORE UPDATE ON templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

Save and exit.

### 3.3 Apply the Schema

Run the following command (you will be prompted for the database user’s password):

```
psql -h localhost -U configlab_user -d configlab_db -f schema.sql -W
```

If there are no errors, the tables are ready.

## 📦 Step 4: Install Node.js and Initialize the Project

### 4.1 Install Node.js 20 LTS

We’ll use the NodeSource repository.

```
# Add NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version   # Should output v20.x
npm --version    # Should output 10.x
```

### 4.2 Initialize npm Project

Make sure you are still in `/var/www/configlab`:

```
npm init -y
```

### 4.3 Install Required Node Packages

Install production dependencies:

```
npm install express cors pg dotenv
```

Optionally install `nodemon` for development (if you plan to test locally):

```
npm install --save-dev nodemon
```

---

## 🔧 Step 5: Create the Application Files

We need three files: environment configuration, database connection module, and the main server.

### 5.1 Environment Variables

Create a `.env` file:

```
nano .env
```

Paste the following **and replace the placeholder values** with your actual data:

```
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=configlab_db
DB_USER=configlab_user
DB_PASSWORD=YourStrongPasswordHere2026

# Application URL (used for share links – update with your domain)
APP_URL=https://configlab.yourdomain.com
```

Save and exit.

### 5.2 Database Connection Module

Create `db.js`:

```
nano db.js
```

Paste this code:

```
const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,                          // maximum number of clients in the pool
    idleTimeoutMillis: 30000,          // close idle clients after 30 seconds
    connectionTimeoutMillis: 2000,      // return an error if connection not established in 2 seconds
});

// Test the database connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.stack);
    } else {
        console.log('✅ Successfully connected to PostgreSQL');
        release();
    }
});

// Handle unexpected pool errors
pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
```

Save and exit.

### 5.3 Main Server Application

Create `server.js`:

```
nano server.js
```

Paste the following code:

```
const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static frontend files from the 'public' folder

// ============= API ROUTES =============

// GET /api/templates - List all templates (id, template_id, name, created_at)
app.get('/api/templates', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, template_id, name, created_at FROM templates ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching templates:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/templates/:template_id - Get a specific template
app.get('/api/templates/:template_id', async (req, res) => {
    try {
        const { template_id } = req.params;
        const result = await db.query(
            'SELECT * FROM templates WHERE template_id = $1',
            [template_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching template:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/templates - Create a new template
app.post('/api/templates', async (req, res) => {
    try {
        const { name, template_text } = req.body;

        if (!name || !template_text) {
            return res.status(400).json({ error: 'Name and template_text are required' });
        }

        // Generate a unique template ID (simple but sufficient)
        const template_id = 'tpl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

        const result = await db.query(
            'INSERT INTO templates (template_id, name, template_text) VALUES ($1, $2, $3) RETURNING id, template_id, name, created_at',
            [template_id, name, template_text]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating template:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /api/templates/:template_id - Delete a template
app.delete('/api/templates/:template_id', async (req, res) => {
    try {
        const { template_id } = req.params;
        const result = await db.query(
            'DELETE FROM templates WHERE template_id = $1 RETURNING id',
            [template_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.status(204).send(); // No content
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============= FRONTEND =============
// For any non-API routes, serve the main HTML file
app.use((req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});
```

Save and exit.

### 5.4 Create the Public Directory and Frontend HTML

```
mkdir public
nano public/index.html
```

Now paste the **frontend HTML** from our previous server‑saved version. It’s the same as the one we used for the server‑based version, but we must ensure the `API_BASE` points to `/api` (relative path). Here’s the complete frontend code (you can copy it as is):

```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>configlab · template studio ({{variables}})</title>
    <style>
        /* (Same styles as before – compact version) */
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1.5rem; background: #f8fafc; color: #0f172a; line-height: 1.5; }
        .container { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 8px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        h1 { font-size: 2rem; font-weight: 600; margin-top: 0; margin-bottom: 0.5rem; color: #0a0f1c; }
        h2 { font-size: 1.3rem; font-weight: 500; margin: 2rem 0 1rem; border-bottom: 2px solid #e9edf2; padding-bottom: 0.3rem; }
        .card { background: #f1f5f9; padding: 1.5rem; border-radius: 12px; margin: 1.5rem 0; }
        .flex-row { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
        textarea, input[type="text"] { width: 100%; padding: 0.8rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem; background: white; box-sizing: border-box; font-family: 'Fira Code', monospace; }
        textarea { min-height: 150px; resize: vertical; }
        button { background: #2563eb; color: white; border: none; padding: 0.7rem 1.5rem; border-radius: 8px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.1s; }
        button:hover { background: #1d4ed8; }
        button.secondary { background: #475569; }
        button.secondary:hover { background: #334155; }
        .form-grid { display: grid; gap: 1.2rem; margin: 1.5rem 0; }
        .form-group label { font-weight: 500; display: block; margin-bottom: 0.3rem; color: #1e293b; }
        .output-area { background: #0f172a; color: #e2e8f0; padding: 1.2rem; border-radius: 8px; font-family: 'Fira Code', monospace; white-space: pre-wrap; word-break: break-all; border: 1px solid #334155; }
        .embed-box { background: #f1f5f9; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        .embed-box textarea { background: #0f172a; color: #a5f3fc; border: 1px solid #334155; font-size: 0.85rem; margin-top: 0.5rem; }
        .template-selector { display: flex; gap: 1rem; align-items: center; margin: 1rem 0 1.5rem; flex-wrap: wrap; }
        .template-selector select { flex: 1; min-width: 250px; padding: 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1; background: white; }
        .info-note { background: #e6f0ff; border-left: 4px solid #2563eb; padding: 0.8rem 1.2rem; border-radius: 0 8px 8px 0; font-size: 0.95rem; margin: 1rem 0; }
        hr { border: none; border-top: 2px dashed #cbd5e1; margin: 2rem 0; }
    </style>
</head>
<body>
<div class="container">
    <h1>📄 configlab · template studio ({{variables}})</h1>
    <p class="info-note">
        ✅ <strong>Server‑saved templates!</strong> Use <code>{{double curly braces}}</code> for variables.
        Create, load, and share templates – they persist for everyone.
    </p>

    <!-- Template selector / quick load -->
    <div class="template-selector">
        <label for="template-list" style="font-weight:500;">📂 Load saved template:</label>
        <select id="template-list">
            <option value="">-- Select a template --</option>
        </select>
        <button id="load-selected" class="secondary">Load</button>
        <button id="delete-selected" class="secondary" style="background:#b91c1c;">Delete</button>
        <button id="refresh-list" class="secondary">🔄 Refresh list</button>
    </div>

    <!-- Create new template area -->
    <div class="card">
        <h2 style="margin-top:0;">➕ Create new template</h2>
        <p>Enter your template text below. Use <code>{{variable name}}</code> for placeholders.</p>
        <textarea id="new-template-text" placeholder="e.g. Hello {{name}}, your code is {{code}}"></textarea>
        <div class="flex-row" style="margin-top:1rem;">
            <button id="save-template-btn">💾 Save as new template</button>
            <button id="reset-default-btn" class="secondary">↺ Reset to router example</button>
        </div>
    </div>

    <!-- Current template display -->
    <h2>📋 Current template</h2>
    <pre id="current-template-pre" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;"></pre>

    <!-- Dynamic form for variables -->
    <div id="dynamic-form-container" class="form-grid"></div>

    <div style="margin: 1.5rem 0 0.5rem;">
        <button id="generate-btn">⚡ Generate Filled Template</button>
    </div>

    <h2>📎 Filled result</h2>
    <div id="output" class="output-area">✨ Click generate to see the completed template.</div>

    <hr />

    <h2>🔗 Sharing</h2>
    <p><em>Fill out the form and share a link that pre‑fills values and loads the same template:</em>
        <a href="#" id="share-link">📋 Copy shareable link</a>
    </p>

    <div class="embed-box">
        <strong>📎 Embed full tool (with this template):</strong>
        <textarea id="embed-full" rows="3" readonly></textarea>
    </div>

    <div class="embed-box">
        <strong>📎 Embed only the variables form:</strong>
        <textarea id="embed-vars" rows="3" readonly></textarea>
    </div>
</div>

<script>
    (function() {
        // --------------------------------------------------------------
        // Configuration – change if your backend runs elsewhere
        const API_BASE = '/api';  // Relative path works behind Nginx proxy

        // Default template (router config)
        const DEFAULT_TEMPLATE = `interface Fa0/0
 ip address {{IP Address}} {{Subnet Mask}}
 no shutdown
ip route 0.0.0.0 0.0.0.0 {{Default Gateway}}`;

        // Currently active template ID and text
        let currentTemplateId = 'default';
        let currentTemplateText = DEFAULT_TEMPLATE;

        // In-memory list of templates (for dropdown)
        let templatesList = [];  // each item: { id, template_id, name }

        // --------------------------------------------------------------
        // Helper: extract variable names from template using {{...}}
        function extractVariables(template) {
            const regex = /{{\s*([^}]+?)\s*}}/g;
            let matches;
            const vars = [];
            while ((matches = regex.exec(template)) !== null) {
                const varName = matches[1].trim();
                if (!vars.includes(varName)) {
                    vars.push(varName);
                }
            }
            return vars;
        }

        // --------------------------------------------------------------
        // Render form fields based on variable list
        function renderForm(variables) {
            const container = document.getElementById('dynamic-form-container');
            if (!variables || variables.length === 0) {
                container.innerHTML = '<p class="small-note">No variables found in this template.</p>';
                return;
            }
            let html = '';
            variables.forEach(name => {
                const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                html += `<div class="form-group">
                    <label for="${id}">${name}:</label>
                    <input type="text" id="${id}" name="${id}" placeholder="Enter value" />
                </div>`;
            });
            container.innerHTML = html;
        }

        // --------------------------------------------------------------
        // Get current form values as object { varName: value }
        function getFormValues() {
            const vars = extractVariables(currentTemplateText);
            const values = {};
            vars.forEach(name => {
                const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const input = document.getElementById(id);
                values[name] = input ? input.value : '';
            });
            return values;
        }

        // --------------------------------------------------------------
        // Set form values from object
        function setFormValues(values) {
            const vars = extractVariables(currentTemplateText);
            vars.forEach(name => {
                const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const input = document.getElementById(id);
                if (input && values[name] !== undefined) {
                    input.value = values[name];
                }
            });
        }

        // --------------------------------------------------------------
        // Fill template with values
        function fillTemplate(template, values) {
            let result = template;
            const vars = extractVariables(template);
            vars.forEach(name => {
                const regex = new RegExp(`{{\\s*${escapeRegExp(name)}\\s*}}`, 'g');
                const value = values[name] || '';
                result = result.replace(regex, value);
            });
            return result;
        }

        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // --------------------------------------------------------------
        // Update output based on current form
        function updateOutput() {
            const values = getFormValues();
            const filled = fillTemplate(currentTemplateText, values);
            document.getElementById('output').innerText = filled;
        }

        // --------------------------------------------------------------
        // Update the whole UI for a new template
        function setCurrentTemplate(templateText, templateId = 'default') {
            currentTemplateText = templateText;
            currentTemplateId = templateId;

            document.getElementById('current-template-pre').innerText = templateText;

            const vars = extractVariables(templateText);
            renderForm(vars);

            // Clear input fields
            vars.forEach(name => {
                const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const input = document.getElementById(id);
                if (input) input.value = '';
            });

            document.getElementById('output').innerText = '✨ Click generate to see the completed template.';
            updateEmbedCodes();
        }

        // --------------------------------------------------------------
        // API calls

        async function fetchTemplatesList() {
            try {
                const res = await fetch(`${API_BASE}/templates`);
                if (!res.ok) throw new Error('Failed to fetch list');
                templatesList = await res.json();
                populateTemplateSelect(templatesList);
            } catch (err) {
                console.error(err);
                alert('Could not load template list from server.');
            }
        }

        function populateTemplateSelect(list) {
            const select = document.getElementById('template-list');
            select.innerHTML = '<option value="">-- Select a template --</option>';
            list.forEach(t => {
                const option = document.createElement('option');
                option.value = t.template_id;   // use template_id as value
                option.textContent = t.name + ' (id: ' + t.template_id.substr(0,6) + '…)';
                select.appendChild(option);
            });
        }

        async function loadTemplateById(id) {
            try {
                const res = await fetch(`${API_BASE}/templates/${id}`);
                if (!res.ok) throw new Error('Template not found');
                const tpl = await res.json();
                setCurrentTemplate(tpl.template_text, tpl.template_id);
                // Update URL
                const url = new URL(window.location);
                url.searchParams.set('template', id);
                window.history.replaceState({}, '', url);
            } catch (err) {
                alert('Error loading template: ' + err.message);
            }
        }

        async function saveNewTemplate(name, templateText) {
            try {
                const res = await fetch(`${API_BASE}/templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, template_text: templateText })
                });
                if (!res.ok) throw new Error('Save failed');
                const newTpl = await res.json();
                templatesList.push({ template_id: newTpl.template_id, name: newTpl.name });
                populateTemplateSelect(templatesList);
                return newTpl.template_id;
            } catch (err) {
                alert('Error saving template: ' + err.message);
                return null;
            }
        }

        async function deleteTemplateById(id) {
            try {
                const res = await fetch(`${API_BASE}/templates/${id}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error('Delete failed');
                // Remove from local list
                templatesList = templatesList.filter(t => t.template_id !== id);
                populateTemplateSelect(templatesList);
                if (currentTemplateId === id) {
                    // revert to default
                    setCurrentTemplate(DEFAULT_TEMPLATE, 'default');
                    const url = new URL(window.location);
                    url.searchParams.delete('template');
                    window.history.replaceState({}, '', url);
                }
            } catch (err) {
                alert('Error deleting template: ' + err.message);
            }
        }

        // --------------------------------------------------------------
        // Embed codes
        function updateEmbedCodes() {
            const baseUrl = window.location.href.split('?')[0];
            let templateParam = '';
            if (currentTemplateId !== 'default') {
                templateParam = `?template=${currentTemplateId}`;
            }
            const fullEmbed = `<iframe src="${baseUrl}${templateParam}" width="100%" height="600" style="border:1px solid #ccc; border-radius:8px;" title="configlab template tool"></iframe>`;
            const varsEmbed = `<iframe src="${baseUrl}${templateParam}&embed=form" width="100%" height="320" style="border:1px solid #ccc; border-radius:8px;" title="configlab variables form"></iframe>`;

            document.getElementById('embed-full').value = fullEmbed;
            document.getElementById('embed-vars').value = varsEmbed;
        }

        // --------------------------------------------------------------
        // Load from URL on page load
        async function loadFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const templateId = urlParams.get('template');
            if (templateId && templateId !== 'default') {
                await loadTemplateById(templateId);
            } else {
                setCurrentTemplate(DEFAULT_TEMPLATE, 'default');
            }

            // Pre-fill form if values are in URL
            const vars = extractVariables(currentTemplateText);
            const prefill = {};
            vars.forEach(name => {
                const val = urlParams.get(name);
                if (val) prefill[name] = val;
            });
            if (Object.keys(prefill).length > 0) {
                setFormValues(prefill);
                updateOutput();
            }
        }

        // --------------------------------------------------------------
        // Event handlers
        document.getElementById('generate-btn').addEventListener('click', updateOutput);

        document.getElementById('save-template-btn').addEventListener('click', async function() {
            const newText = document.getElementById('new-template-text').value.trim();
            if (!newText) {
                alert('Please enter a template.');
                return;
            }
            let name = prompt('Give this template a name:', newText.split('\n')[0].substring(0,30) || 'Unnamed');
            if (name === null) return;
            if (name.trim() === '') name = 'Unnamed';

            const newId = await saveNewTemplate(name, newText);
            if (newId) {
                if (confirm('Template saved. Switch to this new template now?')) {
                    await loadTemplateById(newId);
                }
                document.getElementById('new-template-text').value = '';
            }
        });

        document.getElementById('reset-default-btn').addEventListener('click', () => {
            setCurrentTemplate(DEFAULT_TEMPLATE, 'default');
            const url = new URL(window.location);
            url.searchParams.delete('template');
            window.history.replaceState({}, '', url);
        });

        document.getElementById('load-selected').addEventListener('click', async function() {
            const select = document.getElementById('template-list');
            const id = select.value;
            if (!id) {
                alert('Select a template from the list.');
                return;
            }
            await loadTemplateById(id);
        });

        document.getElementById('delete-selected').addEventListener('click', async function() {
            const select = document.getElementById('template-list');
            const id = select.value;
            if (!id) {
                alert('Select a template to delete.');
                return;
            }
            if (confirm('Delete this template? This cannot be undone.')) {
                await deleteTemplateById(id);
            }
        });

        document.getElementById('refresh-list').addEventListener('click', fetchTemplatesList);

        document.getElementById('share-link').addEventListener('click', function(e) {
            e.preventDefault();
            const url = new URL(window.location);
            url.searchParams.delete('template');
            if (currentTemplateId !== 'default') {
                url.searchParams.set('template', currentTemplateId);
            }
            const values = getFormValues();
            Object.entries(values).forEach(([key, val]) => {
                if (val.trim() !== '') {
                    url.searchParams.set(key, val);
                }
            });
            const shareUrl = url.toString();
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('✅ Shareable link copied to clipboard!\n' + shareUrl);
            }).catch(() => {
                alert('📋 Copy this link manually:\n' + shareUrl);
            });
        });

        // Initialise
        window.addEventListener('load', async function() {
            await fetchTemplatesList();
            await loadFromUrl();
            updateEmbedCodes();
        });
    })();
</script>
</body>
</html>
```

Save and exit.

## 🚀 Step 6: Test the Application Locally

Before using PM2, run the application manually to ensure everything works.

Make sure you are still in `/var/www/configlab`:

```
node server.js
```

You should see:

```
✅ Successfully connected to PostgreSQL
✅ Server running on http://localhost:3000
```

Open another SSH session (or use a second terminal) and test the API:

```
curl http://localhost:3000/api/templates
```

It should return an empty array `[]` (if no templates exist yet).

Test creating a template:

```
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","template_text":"Hello {{name}}!"}'
```

You should get a JSON response with the new template's data.

Press `Ctrl+C` in the first terminal to stop the test server.

---

## 🔄 Step 7: Set Up PM2 Process Manager

PM2 will keep the Node.js application running and restart it if it crashes.

### 7.1 Install PM2 Globally

```
sudo npm install -g pm2
```

### 7.2 Create a PM2 Ecosystem File

This file tells PM2 how to run the app

```
nano ecosystem.config.js
```

Paste:

```
module.exports = {
    apps: [{
        name: 'configlab-app',
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: '/var/log/configlab/err.log',
        out_file: '/var/log/configlab/out.log',
        log_file: '/var/log/configlab/combined.log',
        time: true
    }]
};
```

Save and exit.

### 7.3 Create Log Directory

```
sudo mkdir -p /var/log/configlab
sudo chown $USER:$USER /var/log/configlab
```

### 7.4 Start the Application with PM2

```
pm2 start ecosystem.config.js
```

### 7.5 Save the PM2 Process List and Enable Startup

```
pm2 save
pm2 startup
```

After running `pm2 startup`, you'll see a command that you need to copy and run (it usually starts with `sudo env PATH=$PATH...`). Run that command to ensure PM2 restarts on boot.

### 7.6 Useful PM2 Commands

```
pm2 status               # check status
pm2 logs configlab-app   # view live logs
pm2 monit                # monitor CPU/memory
pm2 restart configlab-app # restart after code updates
```

## 🔗 Step 8: Install and Configure Nginx for LetsEncrypt

For Self-Signed Certificate, go to step 10. Ignore steps 8 & 9.

### 8.1 Install Nginx

```
sudo apt install -y nginx
```

### 8.2 Create Nginx Configuration for configlab

Create a new site configuration file:

```
sudo nano /etc/nginx/sites-available/configlab
```

Paste the following,  **replacing `configlab.yourdomain.com` with your actual domain** :

```
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name configlab.yourdomain.com;

    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name configlab.yourdomain.com;

    # SSL certificates (will be added by Certbot later)
    ssl_certificate /etc/letsencrypt/live/configlab.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/configlab.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/configlab_access.log;
    error_log /var/log/nginx/configlab_error.log;

    # Static files (if any – not used now, but kept for future)
    location /static/ {
        alias /var/www/configlab/public/;
        expires 30d;
    }

    # Proxy all other requests to the Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for large templates
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Save and exit.

### 8.3 Enable the Site and Disable Default

```
# Enable the configlab site
sudo ln -s /etc/nginx/sites-available/configlab /etc/nginx/sites-enabled/

# Remove the default site
sudo rm /etc/nginx/sites-enabled/default

# Test the Nginx configuration
sudo nginx -t

# If the test is successful, reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 Step 9: Set Up SSL with Let's Encrypt

### 9.1 Install Certbot

```
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 Obtain SSL Certificate

Run Certbot and follow the interactive prompts:

```
sudo certbot --nginx -d configlab.yourdomain.com
```

* Enter your email address when prompted.
* Agree to the terms of service.
* Choose whether to redirect HTTP to HTTPS (recommended: yes).

Certbot will automatically modify the Nginx configuration and enable HTTPS.

### 9.3 Test Auto-Renewal

```
sudo certbot renew --dry-run
```

If the dry‑run succeeds, your certificates will be renewed automatically.

# 🔒 Set Up Self‑Signed SSL Certificate (instead of Let's Encrypt)

If
 you prefer to use a self‑signed certificate (for testing, internal
networks, or when you don’t have a domain name), follow this modified
section.
**Note:** Browsers
will show a security warning because the certificate is not issued by a
trusted authority – this is normal for self‑signed certs.

---

## 🔧 Step 10: Install and Configure Nginx for Self-Signed Certificates

For LetsEncrpyt Certificated, go to step 8. Ignore steps 10 & 11.

### 10.1 Install Nginx

```
sudo apt install -y nginx
```

### 10.2 Create Nginx Configuration for configlab

Create a new site configuration file:

```
sudo nano /etc/nginx/sites-available/configlab
```

Paste the following (replace `configlab.yourdomain.com` with your actual server IP or domain name if you have one):

```
# HTTP server – redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name configlab.yourdomain.com;   # or your server's IP

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name configlab.yourdomain.com;   # or your server's IP

    # Path to self‑signed certificates (we'll generate them next)
    ssl_certificate /etc/ssl/certs/configlab.crt;
    ssl_certificate_key /etc/ssl/private/configlab.key;

    # Basic SSL settings (you can adjust these)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/configlab_access.log;
    error_log /var/log/nginx/configlab_error.log;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable the site and remove default:

```
sudo ln -s /etc/nginx/sites-available/configlab /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t   # test configuration (will fail until certificates exist – that's fine)
```

---

## 🛠️ Step 11: Generate Self‑Signed SSL Certificate

Now we create the certificate and private key using OpenSSL.

### 11.1 Create Directories for Certificates (if they don't exist)

```
sudo mkdir -p /etc/ssl/certs
sudo mkdir -p /etc/ssl/private
```

### 11.2 Generate the Self‑Signed Certificate

Run the following command, **replacing `configlab.yourdomain.com`** with your actual server domain or IP address:

```
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/configlab.key \
    -out /etc/ssl/certs/configlab.crt \
    -subj "/CN=configlab.yourdomain.com"
```

If you don't have a domain and are using an IP address, you can use the IP as the Common Name, e.g. `-subj "/CN=192.168.1.100"`.

**Explanation:**

* `req -x509` – create a self‑signed certificate.
* `-nodes` – do not encrypt the private key (no passphrase).
* `-days 365` – valid for one year.
* `-newkey rsa:2048` – generate a new 2048‑bit RSA key.
* `-keyout` and `-out` – where to save the key and certificate.
* `-subj` – set the certificate’s subject (Common Name is the domain/IP).

### 11.3 Set Correct Permissions

The private key should be readable only by root:

```
sudo chmod 600 /etc/ssl/private/configlab.key
```

### 11.4 Test Nginx Configuration Again

```
sudo nginx -t
```

If the test passes, reload Nginx:

```
sudo systemctl reload nginx
```

---

## 🧪 Step 12: Verify SSL

Now visit `https://configlab.yourdomain.com`
 (or your server IP) in a browser. You will see a warning like “Your
connection is not private” – this is expected. Proceed (usually by
clicking “Advanced” and then “Proceed to site”).

The site should load with HTTPS, and the connection will be encrypted even though the certificate is not trusted by browsers.

---

## 🔁 What About Certificate Renewal?

Self‑signed certificates expire after the period set with `-days`
 (here 365 days). When they expire, you will need to generate a new one
manually. You can set up a cron job to renew it yearly if needed.

---

## ⚠️ Important Security Note

* Self‑signed certificates provide **encryption** but  **no identity verification** . They protect data in transit from eavesdropping but do not assure your users that they are connecting to the real server.
* For public production sites, a certificate from a trusted CA (like Let’s Encrypt) is strongly recommended.

## 🛡️ Step 13: Security Hardening

### 13.1 Ensure PostgreSQL Only Listens Locally

Check the PostgreSQL configuration file:

```
sudo nano /etc/postgresql/17/main/postgresql.conf
```

Make sure `listen_addresses` is set to `'localhost'`. If you changed it earlier, it’s already fine.

Restart PostgreSQL to apply any changes:

```
sudo systemctl restart postgresql
```

### 13.2 Set Up Automatic Security Updates

```
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Choose **Yes** when asked if you want to automatically download and install stable updates.

### 13.3 (Optional) Install Fail2ban

```
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Fail2ban helps protect against brute‑force SSH attacks.

---

## 📊 Step 14: Monitoring and Maintenance

### 14.1 Create a Simple Status Check Script

Create a script in your home directory:

```
cd ~
nano check-configlab-status.sh
```

Paste:

```
#!/bin/bash
echo "===== configlab Status Check ====="
echo ""
echo "--- Node.js Application (PM2) ---"
pm2 status configlab-app
echo ""
echo "--- Nginx Status ---"
systemctl status nginx --no-pager | grep "Active:"
echo ""
echo "--- PostgreSQL Status ---"
systemctl status postgresql --no-pager | grep "Active:"
echo ""
echo "--- Disk Usage ---"
df -h / | grep -v Filesystem
echo ""
echo "--- Recent Errors ---"
tail -n 5 /var/log/nginx/configlab_error.log 2>/dev/null || echo "No errors"
```

Make it executable:

```
chmod +x check-configlab-status.sh
```

Run it anytime with `./check-configlab-status.sh`.

### 14.2 Set Up Database Backups

Create a backup directory:

```
sudo mkdir -p /var/backups/postgresql
sudo chown postgres:postgres /var/backups/postgresql
```

Create the backup script:

```
sudo nano /usr/local/bin/backup-configlab-db.sh
```

Paste:

```
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="configlab_db"
DB_USER="configlab_user"

# Perform the dump
sudo -u postgres pg_dump $DB_NAME > $BACKUP_DIR/${DB_NAME}_$DATE.sql

# Compress
gzip $BACKUP_DIR/${DB_NAME}_$DATE.sql

# Keep only the last 7 days of backups
find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_$DATE.sql.gz"
```

Make it executable:

```
sudo chmod +x /usr/local/bin/backup-configlab-db.sh
```

Add a cron job to run it daily at 2 AM:

```
sudo crontab -e
```

Add this line:

```
0 2 * * * /usr/local/bin/backup-configlab-db.sh
```

---

## ✅ Step 15: Final Verification

### 15.1 Check All Services

```
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
```

### 15.2 Test the API

```
curl https://configlab.yourdomain.com/api/templates
```

You should see either an empty array or a list of existing templates.

### 15.3 Browser Test

Open your browser and go to `https://configlab.yourdomain.com`.

* The page should load with the default router template.
* Create a new template and save it – it should appear in the dropdown.
* Delete a template – it should be removed.
* Test the share link functionality.

## 🔧 Troubleshooting

| Problem                                | Likely Cause                                 | Solution                                                                                     |
| -------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Cannot connect to PostgreSQL** | Wrong credentials, or PostgreSQL not running | Check `.env`; run `sudo systemctl status postgresql`                                     |
| **502 Bad Gateway from Nginx**   | Node.js app not running                      | Run `pm2 status`; if down, start with `pm2 start configlab-app`                          |
| **Templates not saving**         | Database permissions                         | In psql:`GRANT ALL PRIVILEGES ON DATABASE configlab_db TO configlab_user;`                 |
| **SSL certificate errors**       | Certbot renewal failed                       | Run `sudo certbot renew --force-renewal`                                                   |
| **API returns 500 errors**       | Database schema missing                      | Re‑run the `schema.sql`script:`psql -U configlab_user -d configlab_db -f schema.sql -W` |
| **Frontend cannot reach API**    | CORS or wrong `API_BASE`                   | Ensure `API_BASE`in `public/index.html`is set to `/api`(relative)                      |

### Useful Log Locations

* **Application logs** : `/var/log/configlab/err.log` and `/var/log/configlab/out.log`
* **Nginx error log** : `/var/log/nginx/configlab_error.log`
* **PostgreSQL log** : `/var/log/postgresql/postgresql-17-main.log`

---

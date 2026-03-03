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
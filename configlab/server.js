const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());           // Allow frontend requests from different origin
app.use(express.json());   // Parse JSON request bodies

// In-memory storage (replace with a real database in production)
let templates = {};
let nextId = 1;

// Helper to generate a new ID
function generateId() {
  return (nextId++).toString();
}

// --- API Endpoints ---

// GET /api/templates – list all templates (id + name)
app.get('/api/templates', (req, res) => {
  const list = Object.entries(templates).map(([id, tpl]) => ({
    id,
    name: tpl.name
  }));
  res.json(list);
});

// GET /api/templates/:id – get a single template by ID
app.get('/api/templates/:id', (req, res) => {
  const id = req.params.id;
  if (templates[id]) {
    res.json(templates[id]);
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// POST /api/templates – create a new template
app.post('/api/templates', (req, res) => {
  const { name, template } = req.body;
  if (!name || !template) {
    return res.status(400).json({ error: 'Missing name or template' });
  }
  const id = generateId();
  templates[id] = { id, name, template };
  res.status(201).json({ id, name, template });
});

// DELETE /api/templates/:id – delete a template
app.delete('/api/templates/:id', (req, res) => {
  const id = req.params.id;
  if (templates[id]) {
    delete templates[id];
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
const express = require('express');
const app = express();

app.use(express.json());

// In-memory data store
const BOOKMARKS = {};
let nextId = 1;

// Get bookmarks (paginated)
app.get('/bookmarks', (req, res) => {
    const skip = parseInt(req.query.skip || '0', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    
    const list = Object.values(BOOKMARKS);
    res.json(list.slice(skip, skip + limit));
});

// Get bookmark by ID
app.get('/bookmarks/:bookmark_id', (req, res) => {
    const id = parseInt(req.params.bookmark_id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ detail: 'ID must be an integer' });
    }
    if (!BOOKMARKS[id]) {
        return res.status(404).json({ detail: 'Bookmark not found' });
    }
    res.json(BOOKMARKS[id]);
});

// Create bookmark
app.post('/bookmarks', (req, res) => {
    const { url, title } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ detail: 'Field "url" is required and must be a string' });
    }
    
    const entry = { id: nextId++, url, title: title || null };
    BOOKMARKS[entry.id] = entry;
    res.status(201).json(entry);
});

// Delete bookmark
app.delete('/bookmarks/:bookmark_id', (req, res) => {
    const id = parseInt(req.params.bookmark_id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ detail: 'ID must be an integer' });
    }
    if (!BOOKMARKS[id]) {
        return res.status(404).json({ detail: 'Bookmark not found' });
    }
    delete BOOKMARKS[id];
    res.status(204).send();
});

app.listen(8000, () => console.log('Express server running on http://127.0.0.1:8000'));
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const GraphService = require('../services/graphService');
const Person = require('../models/Person');
const Union = require('../models/Union');

// Get Tree Graph
router.get('/:personId', auth, async (req, res) => {
    try {
        const { nodes, unions } = await GraphService.getGraph(req.params.personId, req.userId);
        const layout = GraphService.computeLayout(nodes, unions);
        res.json(layout);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

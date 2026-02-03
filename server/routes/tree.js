const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const GraphService = require('../services/graphService');
const Person = require('../models/Person');
const Union = require('../models/Union');

// Get Tree Graph
router.get('/:personId', auth, async (req, res) => {
    try {
        const collapsedDescendants = req.query.collapsedDescendants ? req.query.collapsedDescendants.split(',') : [];
        const collapsedAncestors = req.query.collapsedAncestors ? req.query.collapsedAncestors.split(',') : [];

        const collapseConfig = {
            hideDescendants: collapsedDescendants,
            hideAncestors: collapsedAncestors
        };

        const { nodes, unions } = await GraphService.getGraph(req.params.personId, req.userId, collapseConfig);
        const layout = GraphService.computeLayout(nodes, unions);
        res.json(layout);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Get all unions for a user (useful for management)
router.get('/unions/all', auth, async (req, res) => {
    try {
        const unions = await Union.find({ userId: req.userId })
            .populate('partnerIds', 'firstName lastName')
            .populate('childrenIds', 'firstName lastName');
        res.json(unions);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Get specific union with details
router.get('/union/:unionId', auth, async (req, res) => {
    try {
        const union = await Union.findOne({ 
            _id: req.params.unionId, 
            userId: req.userId 
        }).populate('partnerIds childrenIds');
        
        if (!union) {
            return res.status(404).json({ error: 'Union non trovata' });
        }
        
        res.json(union);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Add child to a specific union
router.post('/union/:unionId/child', auth, async (req, res) => {
    try {
        const { childId, type, parentType } = req.body; 
        const relationType = type || parentType || 'bio';
        
        const union = await Union.findOne({ 
            _id: req.params.unionId, 
            userId: req.userId 
        });
        
        if (!union) {
            return res.status(404).json({ error: 'Union non trovata' });
        }
        
        // Usa GraphService per aggiungere il figlio (se non c'è già)
        await GraphService.addChildToUnion(req.params.unionId, childId);
        
        // Aggiorna il tipo di parentela se necessario
        const child = await Person.findById(childId);
        if (child) {
            let changed = false;
            // Aggiorna il tipo di parentela per i partner della union
            for (const partnerId of union.partnerIds) {
                const existingRef = child.parentRefs.find(
                    ref => ref.parentId.toString() === partnerId.toString()
                );
                if (existingRef) {
                    if (existingRef.type !== relationType) {
                        existingRef.type = relationType;
                        changed = true;
                    }
                }
            }
            if (changed) {
                await child.save();
            }
        }
        
        const updatedUnion = await Union.findById(req.params.unionId)
            .populate('partnerIds childrenIds');
        
        res.json(updatedUnion);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Remove child from union
router.delete('/union/:unionId/child/:childId', auth, async (req, res) => {
    try {
        const union = await Union.findOne({ 
            _id: req.params.unionId, 
            userId: req.userId 
        });
        
        if (!union) {
            return res.status(404).json({ error: 'Union non trovata' });
        }
        
        // Rimuovi figlio dalla union
        union.childrenIds = union.childrenIds.filter(
            id => id.toString() !== req.params.childId
        );
        await union.save();
        
        const updatedUnion = await Union.findById(req.params.unionId)
            .populate('partnerIds childrenIds');
        
        res.json(updatedUnion);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Get potential children for a union (children of either partner not yet in union)
router.get('/union/:unionId/potential-children', auth, async (req, res) => {
    try {
        const union = await Union.findOne({ 
            _id: req.params.unionId, 
            userId: req.userId 
        });
        
        if (!union) {
            return res.status(404).json({ error: 'Union non trovata' });
        }
        
        // Trova tutti i figli dei partner
        const allChildren = await Person.find({
            userId: req.userId,
            $or: [
                { 'parentRefs.parentId': { $in: union.partnerIds } },
                { 'parents': { $in: union.partnerIds } }
            ]
        });
        
        // Filtra quelli già nella union
        const currentChildIds = union.childrenIds.map(id => id.toString());
        const potentialChildren = allChildren.filter(
            child => !currentChildIds.includes(child._id.toString())
        );
        
        // Per ogni figlio, indica quali partner sono genitori
        const childrenWithParents = potentialChildren.map(child => {
            const parentRefs = child.parentRefs || [];
            const legacyParents = child.parents || [];
            
            const isChildOf = union.partnerIds.map(partnerId => {
                const partnerIdStr = partnerId.toString();
                const hasInParentRefs = parentRefs.some(
                    ref => ref.parentId.toString() === partnerIdStr
                );
                const hasInLegacy = legacyParents.some(
                    p => p.toString() === partnerIdStr
                );
                return hasInParentRefs || hasInLegacy;
            });
            
            return {
                ...child.toObject(),
                isChildOfPartner1: isChildOf[0],
                isChildOfPartner2: isChildOf[1],
                isBiological: isChildOf[0] && isChildOf[1]
            };
        });
        
        res.json(childrenWithParents);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Maintenance Routine: Fix Duplicate Unions
// Finds unions with same partners, merges their children, and deletes duplicates
router.post('/maintenance/repair-unions', auth, async (req, res) => {
    try {
        const result = await GraphService.repairDuplicateUnions(req.userId);
        res.json({ 
            message: 'Riparazione completata', 
            coppieUnite: result.merged, 
            unionRimosse: result.deleted 
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});


module.exports = router;

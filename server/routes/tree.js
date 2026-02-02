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

// Maintenance Routine: Fix Duplicate Unions
// Finds unions with same partners, merges their children, and deletes duplicates
router.post('/maintenance/repair-unions', auth, async (req, res) => {
    try {
        const allUnions = await Union.find({ userId: req.userId });
        const unionsByKey = new Map();
        let fixedCount = 0;
        let removedCount = 0;

        // 1. Group by Partner Key
        for (const u of allUnions) {
             const key = u.partnerIds.map(String).sort().join('-');
             if (!unionsByKey.has(key)) {
                 unionsByKey.set(key, []);
             }
             unionsByKey.get(key).push(u);
        }

        // 2. Merge Duplicates
        for (const [key, duplicates] of unionsByKey) {
            if (duplicates.length > 1) {
                // Keep the first one (or the one with most info?)
                // Let's keep the first one found as master
                const master = duplicates[0];
                const others = duplicates.slice(1);

                // Merge children
                const allChildren = new Set(master.childrenIds.map(String));
                
                for (const other of others) {
                    other.childrenIds.forEach(c => allChildren.add(String(c)));
                    // Update Persons who referenced the 'other' union? 
                    // Persons reference Unions via 'unionIds'. We must fix this.
                    // Find persons referencing 'other._id' and swap to 'master._id'
                    await Person.updateMany(
                        { unionIds: other._id },
                        { $addToSet: { unionIds: master._id } }
                    );
                    await Person.updateMany(
                        { unionIds: other._id },
                        { $pull: { unionIds: other._id } }
                    );
                }

                master.childrenIds = Array.from(allChildren);
                await master.save();

                // Delete others
                const otherIds = others.map(o => o._id);
                await Union.deleteMany({ _id: { $in: otherIds } });

                fixedCount++;
                removedCount += others.length;
            }
        }

        res.json({ message: 'Repair complete', fixedCouples: fixedCount, removedUnions: removedCount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});


module.exports = router;

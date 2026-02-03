const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Fix paths relative to script location
const Person = require('../server/models/Person');
const Union = require('../server/models/Union');

// Hardcode URI since .env is missing or loaded via Docker
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/genealogical-tree';

const fixOrphanedChildren = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Trova tutti gli utenti unici o cicla su tutti
        const persons = await Person.find({});
        console.log(`Found ${persons.length} persons`);

        const parentIds = new Set();
        
        for (const child of persons) {
            // Se ha genitori
            if (child.parentRefs && child.parentRefs.length > 0) {
                // Ottieni tutti gli ID dei genitori
                const parentIds = child.parentRefs.map(r => r.parentId.toString());
                
                // Cerca TUTTE le union che coinvolgono ALMENO UNO dei genitori
                const relevantUnions = await Union.find({
                    partnerIds: { $in: parentIds }
                });

                for (const union of relevantUnions) {
                    const childIdStr = child._id.toString();
                    const isInUnion = union.childrenIds.some(id => id.toString() === childIdStr);

                    if (!isInUnion) {
                        console.log(`Syncing child ${child.firstName} to union ${union._id} (Parent match)`);
                        union.childrenIds.push(child._id);
                        await union.save();
                    }
                }
            }
        }

        console.log('Fix completed');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

fixOrphanedChildren();

/**
 * Script di migrazione per sincronizzare le relazioni esistenti con il nuovo sistema Union-based
 * Esegui con: node scripts/migrateRelationships.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const Person = require('../server/models/Person');
const Union = require('../server/models/Union');
const GraphService = require('../server/services/graphService');

async function migrateRelationships() {
    try {
        // Connetti al database
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/genealogical-tree';
        await mongoose.connect(mongoUri);
        console.log('✅ Connesso al database:', mongoUri);

        // 1. Sincronizza parentRefs da parents legacy
        console.log('\n📋 Step 1: Sincronizzazione parentRefs...');
        const allPersons = await Person.find({});
        let parentRefsUpdated = 0;

        for (const person of allPersons) {
            let updated = false;

            // Se ha parents ma non parentRefs, crea parentRefs
            if (person.parents && person.parents.length > 0) {
                const existingParentIds = (person.parentRefs || []).map(ref => ref.parentId.toString());
                
                for (const parentId of person.parents) {
                    if (!existingParentIds.includes(parentId.toString())) {
                        if (!person.parentRefs) person.parentRefs = [];
                        person.parentRefs.push({
                            parentId,
                            type: 'bio'
                        });
                        updated = true;
                    }
                }
            }

            if (updated) {
                await person.save();
                parentRefsUpdated++;
            }
        }

        console.log(`   ✓ ${parentRefsUpdated} persone aggiornate con parentRefs`);

        // 2. Crea Unions da spouse legacy
        console.log('\n💑 Step 2: Creazione Unions da spouse...');
        let unionsCreated = 0;
        const processedCouples = new Set();

        for (const person of allPersons) {
            if (!person.spouse || person.spouse.length === 0) continue;

            for (const spouseId of person.spouse) {
                // Crea chiave univoca per la coppia (ordinata)
                const coupleKey = [person._id.toString(), spouseId.toString()].sort().join('-');
                
                // Se già processata, salta
                if (processedCouples.has(coupleKey)) continue;
                processedCouples.add(coupleKey);

                try {
                    // Crea o recupera Union
                    const union = await GraphService.createUnion(
                        person._id, 
                        spouseId, 
                        person.userId
                    );
                    
                    // Trova figli comuni
                    const person1 = await Person.findById(person._id);
                    const person2 = await Person.findById(spouseId);
                    
                    if (person1 && person2) {
                        const children1 = (person1.children || []).map(c => c.toString());
                        const children2 = (person2.children || []).map(c => c.toString());
                        
                        // Figli comuni = presenti in entrambi
                        const commonChildren = children1.filter(c => children2.includes(c));
                        
                        // Aggiungi figli comuni alla union
                        for (const childId of commonChildren) {
                            if (!union.childrenIds.some(id => id.toString() === childId)) {
                                union.childrenIds.push(childId);
                            }
                        }
                        
                        if (commonChildren.length > 0) {
                            await union.save();
                        }
                    }
                    
                    unionsCreated++;
                } catch (error) {
                    console.error(`   ⚠ Errore creando union per ${person._id}-${spouseId}:`, error.message);
                }
            }
        }

        console.log(`   ✓ ${unionsCreated} Unions create/verificate`);

        // 3. Ripara duplicati
        console.log('\n🔧 Step 3: Riparazione duplicati...');
        const users = await Person.distinct('userId');
        let totalMerged = 0;
        let totalDeleted = 0;

        for (const userId of users) {
            const result = await GraphService.repairDuplicateUnions(userId);
            totalMerged += result.merged;
            totalDeleted += result.deleted;
        }

        console.log(`   ✓ ${totalMerged} coppie unite, ${totalDeleted} union duplicate rimosse`);

        // 4. Statistiche finali
        console.log('\n📊 Statistiche finali:');
        const totalPersons = await Person.countDocuments();
        const totalUnions = await Union.countDocuments();
        const personsWithParents = await Person.countDocuments({ 'parentRefs.0': { $exists: true } });
        const personsWithUnions = await Person.countDocuments({ 'unionIds.0': { $exists: true } });

        console.log(`   • Persone totali: ${totalPersons}`);
        console.log(`   • Persone con genitori: ${personsWithParents}`);
        console.log(`   • Persone con unions: ${personsWithUnions}`);
        console.log(`   • Unions totali: ${totalUnions}`);

        console.log('\n✅ Migrazione completata con successo!');

    } catch (error) {
        console.error('❌ Errore durante la migrazione:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnesso dal database');
    }
}

// Esegui
migrateRelationships();

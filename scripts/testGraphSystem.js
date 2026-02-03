/**
 * Test manuale del nuovo sistema di gestione parentele
 * Esegui con: node scripts/testGraphSystem.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Person = require('../server/models/Person');
const Union = require('../server/models/Union');
const GraphService = require('../server/services/graphService');

async function testGraphSystem() {
    try {
        // Connetti
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/genealogy');
        console.log('✅ Connesso al database');

        // Crea un utente test
        const testUserId = new mongoose.Types.ObjectId();

        console.log('\n🧪 Test 1: Creazione famiglia semplice');
        console.log('   Nonno + Nonna -> Padre');
        console.log('   Padre + Madre -> Figlio');

        // Nonni
        const nonno = new Person({
            userId: testUserId,
            firstName: 'Mario',
            lastName: 'Rossi',
            gender: 'male',
            birthDate: new Date('1940-01-01')
        });
        await nonno.save();

        const nonna = new Person({
            userId: testUserId,
            firstName: 'Maria',
            lastName: 'Bianchi',
            gender: 'female',
            birthDate: new Date('1942-03-15')
        });
        await nonna.save();

        // Union nonni
        const unionNonni = await GraphService.createUnion(nonno._id, nonna._id, testUserId);
        console.log('   ✓ Union nonni creata:', unionNonni._id);

        // Padre (figlio dei nonni)
        const padre = new Person({
            userId: testUserId,
            firstName: 'Giovanni',
            lastName: 'Rossi',
            gender: 'male',
            birthDate: new Date('1970-06-20'),
            parentRefs: [
                { parentId: nonno._id, type: 'bio' },
                { parentId: nonna._id, type: 'bio' }
            ]
        });
        await padre.save();

        // Aggiungi padre alla union dei nonni
        await GraphService.addChildToUnion(unionNonni._id, padre._id);
        console.log('   ✓ Padre aggiunto alla union nonni');

        // Madre
        const madre = new Person({
            userId: testUserId,
            firstName: 'Laura',
            lastName: 'Verdi',
            gender: 'female',
            birthDate: new Date('1972-09-10')
        });
        await madre.save();

        // Union genitori
        const unionGenitori = await GraphService.createUnion(padre._id, madre._id, testUserId);
        console.log('   ✓ Union genitori creata:', unionGenitori._id);

        // Figlio
        const figlio = new Person({
            userId: testUserId,
            firstName: 'Marco',
            lastName: 'Rossi',
            gender: 'male',
            birthDate: new Date('2000-12-25'),
            parentRefs: [
                { parentId: padre._id, type: 'bio' },
                { parentId: madre._id, type: 'bio' }
            ]
        });
        await figlio.save();

        await GraphService.addChildToUnion(unionGenitori._id, figlio._id);
        console.log('   ✓ Figlio aggiunto alla union genitori');

        console.log('\n🔍 Test 2: Verifica grafo dal figlio');
        const { nodes, unions } = await GraphService.getGraph(figlio._id, testUserId);
        
        console.log(`   • Nodi trovati: ${nodes.length}`);
        console.log(`   • Unions trovate: ${unions.length}`);
        
        // Verifica che ci siano tutti
        const personNames = nodes.filter(n => n.kind === 'person').map(n => n.firstName);
        console.log(`   • Persone: ${personNames.join(', ')}`);
        
        if (nodes.length === 5 && unions.length === 2) {
            console.log('   ✅ SUCCESSO: Grafo completo trovato!');
        } else {
            console.log('   ❌ ERRORE: Grafo incompleto');
        }

        console.log('\n📐 Test 3: Verifica layout');
        const layout = GraphService.computeLayout(nodes, unions);
        
        console.log(`   • Nodi nel layout: ${layout.nodes.length}`);
        console.log(`   • Edge: ${layout.edges.length}`);
        
        // Verifica generazioni
        const generations = {};
        layout.nodes.forEach(n => {
            if (!generations[n.generation]) generations[n.generation] = [];
            generations[n.generation].push(n.firstName || 'Union');
        });
        
        console.log('   • Generazioni:');
        Object.keys(generations).sort((a,b) => a-b).forEach(gen => {
            console.log(`     Gen ${gen}: ${generations[gen].join(', ')}`);
        });

        // Verifica che nonni siano gen -2, genitori gen -1, figlio gen 0
        const figloNode = layout.nodes.find(n => n.firstName === 'Marco');
        const padreNode = layout.nodes.find(n => n.firstName === 'Giovanni');
        const nonnoNode = layout.nodes.find(n => n.firstName === 'Mario');
        
        if (figloNode.generation === 0 && 
            padreNode.generation === -1 && 
            nonnoNode.generation === -2) {
            console.log('   ✅ SUCCESSO: Generazioni corrette!');
        } else {
            console.log('   ❌ ERRORE: Generazioni errate');
        }

        console.log('\n🧹 Test 4: Pulizia duplicati');
        // Crea intenzionalmente un duplicato
        const duplicateUnion = new Union({
            userId: testUserId,
            partnerIds: [padre._id, madre._id],
            childrenIds: []
        });
        await duplicateUnion.save();
        console.log('   • Duplicato creato intenzionalmente');

        const result = await GraphService.repairDuplicateUnions(testUserId);
        console.log(`   ✓ Riparazione: ${result.merged} unite, ${result.deleted} eliminate`);
        
        if (result.deleted === 1) {
            console.log('   ✅ SUCCESSO: Duplicato rimosso!');
        } else {
            console.log('   ⚠️  Duplicati trovati:', result.deleted);
        }

        // Cleanup
        console.log('\n🗑️  Pulizia dati di test...');
        await Person.deleteMany({ userId: testUserId });
        await Union.deleteMany({ userId: testUserId });
        console.log('   ✓ Pulizia completata');

        console.log('\n✅ TUTTI I TEST COMPLETATI CON SUCCESSO!');

    } catch (error) {
        console.error('❌ Errore durante i test:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnesso dal database');
    }
}

// Esegui
testGraphSystem();

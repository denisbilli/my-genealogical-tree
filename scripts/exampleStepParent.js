/**
 * Esempio: Gestione Famiglia Ricomposta con Step-Parent
 * 
 * Scenario:
 * - Mario ha un figlio (Giovanni) da una relazione precedente
 * - Mario sposa Laura
 * - Mario e Laura hanno un figlio comune (Luca)
 * - Laura NON è madre biologica di Giovanni (è step-mother)
 */

const mongoose = require('mongoose');
const Person = require('./server/models/Person');
const Union = require('./server/models/Union');
const GraphService = require('./server/services/graphService');

async function exampleStepParentFamily() {
    try {
        await mongoose.connect('mongodb://mongo:27017/genealogical-tree');
        console.log('✅ Connesso al database\n');
        
        const testUserId = new mongoose.Types.ObjectId();
        
        console.log('📖 Scenario: Famiglia Ricomposta');
        console.log('═══════════════════════════════════');
        console.log('Mario (padre) + Ex -> Giovanni');
        console.log('Mario + Laura (matrigna) -> Luca\n');
        
        // 1. Crea Mario
        console.log('1️⃣ Creazione Mario...');
        const mario = new Person({
            userId: testUserId,
            firstName: 'Mario',
            lastName: 'Rossi',
            gender: 'male',
            birthDate: new Date('1980-01-01')
        });
        await mario.save();
        console.log('   ✓ Mario creato\n');
        
        // 2. Crea Giovanni (figlio di Mario da relazione precedente)
        console.log('2️⃣ Creazione Giovanni (figlio di Mario)...');
        const giovanni = new Person({
            userId: testUserId,
            firstName: 'Giovanni',
            lastName: 'Rossi',
            gender: 'male',
            birthDate: new Date('2005-06-15'),
            parentRefs: [
                { parentId: mario._id, type: 'bio' }
            ],
            parents: [mario._id] // Legacy
        });
        await giovanni.save();
        
        // Aggiorna Mario
        mario.children.push(giovanni._id);
        await mario.save();
        
        console.log('   ✓ Giovanni creato');
        console.log('   • Giovanni ha 1 genitore biologico: Mario\n');
        
        // 3. Crea Laura (nuova partner di Mario)
        console.log('3️⃣ Creazione Laura...');
        const laura = new Person({
            userId: testUserId,
            firstName: 'Laura',
            lastName: 'Verdi',
            gender: 'female',
            birthDate: new Date('1982-03-10')
        });
        await laura.save();
        console.log('   ✓ Laura creata\n');
        
        // 4. Crea Union tra Mario e Laura (SENZA Giovanni!)
        console.log('4️⃣ Creazione Union Mario + Laura...');
        const unionMarioLaura = await GraphService.createUnion(
            mario._id, 
            laura._id, 
            testUserId
        );
        console.log('   ✓ Union creata');
        console.log('   • childrenIds:', unionMarioLaura.childrenIds.length, '(vuoto, corretto!)');
        console.log('   ⚠️  Giovanni NON è in questa union (Laura non è sua madre)\n');
        
        // 5. Crea Luca (figlio biologico di entrambi)
        console.log('5️⃣ Creazione Luca (figlio comune)...');
        const luca = new Person({
            userId: testUserId,
            firstName: 'Luca',
            lastName: 'Rossi',
            gender: 'male',
            birthDate: new Date('2015-09-20'),
            parentRefs: [
                { parentId: mario._id, type: 'bio' },
                { parentId: laura._id, type: 'bio' }
            ],
            parents: [mario._id, laura._id]
        });
        await luca.save();
        console.log('   ✓ Luca creato');
        console.log('   • Luca ha 2 genitori biologici: Mario e Laura\n');
        
        // 6. Aggiungi Luca alla Union
        console.log('6️⃣ Aggiunta Luca alla Union Mario+Laura...');
        await GraphService.addChildToUnion(unionMarioLaura._id, luca._id);
        console.log('   ✓ Luca aggiunto alla union\n');
        
        // 7. Verifica stato finale
        console.log('📊 Verifica Stato Finale');
        console.log('═══════════════════════════════════');
        
        const finalUnion = await Union.findById(unionMarioLaura._id);
        console.log('Union Mario + Laura:');
        console.log('  • Partner:', finalUnion.partnerIds.length);
        console.log('  • Figli:', finalUnion.childrenIds.length);
        console.log('  • Include Giovanni?', finalUnion.childrenIds.some(id => id.toString() === giovanni._id.toString()), '(NO, corretto!)');
        console.log('  • Include Luca?', finalUnion.childrenIds.some(id => id.toString() === luca._id.toString()), '(SÌ, corretto!)\n');
        
        const giovanniRefresh = await Person.findById(giovanni._id);
        console.log('Giovanni:');
        console.log('  • Genitori biologici:', giovanniRefresh.parentRefs.length, '(solo Mario)');
        console.log('  • È figlio di Laura?', giovanniRefresh.parentRefs.some(r => r.parentId.toString() === laura._id.toString()), '(NO, corretto!)\n');
        
        const lucaRefresh = await Person.findById(luca._id);
        console.log('Luca:');
        console.log('  • Genitori biologici:', lucaRefresh.parentRefs.length, '(Mario e Laura)');
        
        // 8. Test grafo
        console.log('\n🗺️  Test Grafo');
        console.log('═══════════════════════════════════');
        const { nodes, unions } = await GraphService.getGraph(mario._id, testUserId);
        console.log('Nodi nel grafo:', nodes.length);
        console.log('Union nel grafo:', unions.length);
        
        console.log('\nPersone:');
        nodes.filter(n => n.kind === 'person').forEach(n => {
            console.log(`  • ${n.firstName} (gen ${n.generation})`);
        });
        
        console.log('\nUnion:');
        unions.forEach(u => {
            console.log(`  • Union con ${u.childrenIds.length} figli`);
        });
        
        // 9. Scenario Opzionale: Laura adotta Giovanni
        console.log('\n🔄 Scenario Alternativo: Laura Adotta Giovanni');
        console.log('═══════════════════════════════════');
        giovanni.parentRefs.push({
            parentId: laura._id,
            type: 'adoptive'
        });
        await giovanni.save();
        
        // Aggiungi Giovanni alla union
        finalUnion.childrenIds.push(giovanni._id);
        await finalUnion.save();
        
        console.log('✓ Giovanni ora ha Laura come madre adottiva');
        console.log('✓ Giovanni è stato aggiunto alla union Mario+Laura');
        
        const giovanniAdopted = await Person.findById(giovanni._id);
        console.log('\nGiovanni (dopo adozione):');
        console.log('  • Genitori:', giovanniAdopted.parentRefs.length);
        giovanniAdopted.parentRefs.forEach(ref => {
            const parent = ref.parentId.toString() === mario._id.toString() ? 'Mario' : 'Laura';
            console.log(`    - ${parent} (${ref.type})`);
        });
        
        // Cleanup
        console.log('\n🧹 Pulizia...');
        await Person.deleteMany({ userId: testUserId });
        await Union.deleteMany({ userId: testUserId });
        console.log('✓ Dati di test rimossi\n');
        
        console.log('✅ ESEMPIO COMPLETATO CON SUCCESSO!');
        console.log('\n📚 Lezioni Chiave:');
        console.log('   1. Union non aggiunge automaticamente i figli dei partner');
        console.log('   2. Puoi specificare il tipo di parentela (bio, adoptive, step, foster)');
        console.log('   3. Union.childrenIds contiene solo i figli ESPLICITAMENTE aggiunti');
        console.log('   4. Il grafo visualizza correttamente le relazioni complesse');
        
    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnesso dal database');
    }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
    exampleStepParentFamily();
}

module.exports = exampleStepParentFamily;

const mongoose = require('mongoose');
const Person = require('./server/models/Person');
const Union = require('./server/models/Union');
const GraphService = require('./server/services/graphService');

async function migrate() {
  try {
    await mongoose.connect('mongodb://mongo:27017/genealogical-tree');
    console.log('✅ Connesso al database');
    
    const allPersons = await Person.find({});
    console.log('\n📋 Trovate', allPersons.length, 'persone');
    
    // 1. Sync parentRefs
    console.log('\n1️⃣ Sincronizzazione parentRefs...');
    let parentRefsUpdated = 0;
    for (const person of allPersons) {
      let updated = false;
      if (person.parents && person.parents.length > 0) {
        const existingIds = (person.parentRefs || []).map(r => r.parentId.toString());
        for (const parentId of person.parents) {
          if (existingIds.indexOf(parentId.toString()) === -1) {
            if (!person.parentRefs) person.parentRefs = [];
            person.parentRefs.push({ parentId, type: 'bio' });
            updated = true;
          }
        }
      }
      if (updated) {
        await person.save();
        parentRefsUpdated++;
      }
    }
    console.log('   ✓', parentRefsUpdated, 'persone con parentRefs aggiornati');
    
    // 2. Create Unions from spouse
    console.log('\n2️⃣ Creazione Union da spouse...');
    let unionsCreated = 0;
    const processed = new Set();
    
    for (const person of allPersons) {
      if (!person.spouse || person.spouse.length === 0) continue;
      
      for (const spouseId of person.spouse) {
        const key = [person._id.toString(), spouseId.toString()].sort().join('-');
        if (processed.has(key)) continue;
        processed.add(key);
        
        try {
          await GraphService.createUnion(person._id, spouseId, person.userId);
          unionsCreated++;
          console.log('   ✓ Union creata per', person.firstName, '&', (await Person.findById(spouseId)).firstName);
        } catch (e) {
          console.log('   ⚠️  Errore:', e.message);
        }
      }
    }
    console.log('   ✓ Totale:', unionsCreated, 'Union create');
    
    // 3. Add children to unions
    console.log('\n3️⃣ Aggiunta figli alle Union...');
    const unions = await Union.find({});
    let childrenAdded = 0;
    
    for (const union of unions) {
      const [p1Id, p2Id] = union.partnerIds;
      const p1 = await Person.findById(p1Id);
      const p2 = await Person.findById(p2Id);
      
      if (p1 && p2) {
        const children1 = (p1.children || []).map(c => c.toString());
        const children2 = (p2.children || []).map(c => c.toString());
        
        // Figli comuni (presenti in entrambi)
        const common = children1.filter(c => children2.indexOf(c) !== -1);
        
        // ANCHE: figli che hanno ENTRAMBI questi genitori in parentRefs
        const allChildren = await Person.find({
          'parentRefs.parentId': { $in: [p1Id, p2Id] }
        });
        
        for (const child of allChildren) {
          const parentIds = child.parentRefs.map(r => r.parentId.toString());
          const hasP1 = parentIds.indexOf(p1Id.toString()) !== -1;
          const hasP2 = parentIds.indexOf(p2Id.toString()) !== -1;
          
          // Se ha entrambi i genitori, aggiungi alla union
          if (hasP1 && hasP2) {
            const childIdStr = child._id.toString();
            if (common.indexOf(childIdStr) === -1) {
              common.push(childIdStr);
            }
          }
        }
        
        for (const childId of common) {
          const hasChild = union.childrenIds.some(id => id.toString() === childId);
          if (!hasChild) {
            union.childrenIds.push(childId);
            childrenAdded++;
          }
        }
        
        if (common.length > 0) {
          await union.save();
          console.log('   ✓ Aggiunti', common.length, 'figli a union di', p1.firstName, '&', p2.firstName);
        }
      }
    }
    console.log('   ✓ Totale:', childrenAdded, 'figli aggiunti');
    
    // 4. Repair duplicates
    console.log('\n4️⃣ Riparazione duplicati...');
    const users = await Person.distinct('userId');
    let totalMerged = 0;
    let totalDeleted = 0;
    
    for (const userId of users) {
      const result = await GraphService.repairDuplicateUnions(userId);
      totalMerged += result.merged;
      totalDeleted += result.deleted;
    }
    console.log('   ✓', totalMerged, 'coppie unite,', totalDeleted, 'union duplicate rimosse');
    
    console.log('\n📊 Statistiche finali:');
    console.log('   • Persone totali:', await Person.countDocuments());
    console.log('   • Union totali:', await Union.countDocuments());
    console.log('   • Persone con genitori:', await Person.countDocuments({ 'parentRefs.0': { $exists: true } }));
    console.log('   • Persone con union:', await Person.countDocuments({ 'unionIds.0': { $exists: true } }));
    
    console.log('\n✅ Migrazione completata con successo!');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Errore durante la migrazione:', err);
    process.exit(1);
  }
}

migrate();

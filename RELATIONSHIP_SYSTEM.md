# Sistema di Gestione Parentele - Documentazione

## 📋 Panoramica

Il sistema di gestione delle relazioni genealogiche è stato completamente riscritto per garantire:
- ✅ Eliminazione dei duplicati di Union
- ✅ Nessun "ghost node" o doppi punti
- ✅ Logica pulita e manutenibile
- ✅ Supporto completo per relazioni complesse

## 🏗️ Architettura

### Modelli

#### Person
```javascript
{
  // Campi base
  firstName, lastName, gender, birthDate, deathDate, etc.
  
  // NUOVO SCHEMA (preferito)
  parentRefs: [{
    parentId: ObjectId,
    type: 'bio' | 'adoptive' | 'step' | 'foster',
    certainty: Number
  }],
  unionIds: [ObjectId], // Riferimenti alle Union dove è partner
  
  // LEGACY (mantenuto per compatibilità)
  parents: [ObjectId],
  children: [ObjectId],
  spouse: [ObjectId]
}
```

#### Union
```javascript
{
  partnerIds: [ObjectId, ObjectId], // 2 partner (o 1 per single parent)
  childrenIds: [ObjectId],
  type: 'marriage' | 'civil' | 'relationship' | 'unknown',
  startDate: Date,
  endDate: Date,
  userId: ObjectId
}
```

## 🔧 Funzionalità Principali

### GraphService.getGraph(focusId, userId)
Costruisce il grafo genealogico completo usando BFS:
1. Parte dalla persona focus (generazione 0)
2. Attraversa gli antenati (generazioni negative) usando `parentRefs`
3. Attraversa i discendenti (generazioni positive) usando `Union.childrenIds`
4. Include automaticamente i partner trovando tutte le Union dove la persona è partner

**Vantaggi:**
- ✅ Nessuna duplicazione: ogni union viene aggiunta una sola volta
- ✅ Nessun ghost node: solo union reali dal database
- ✅ Supporto legacy: fallback automatico per vecchi dati

### GraphService.computeLayout(nodes, unions)
Calcola le posizioni (x, y) per il rendering:
1. Organizza per generazione
2. Raggruppa intelligentemente le coppie: `[Person1, Union, Person2]`
3. Posiziona le union esattamente al centro dei partner
4. Genera gli edge (linee di connessione)

**Ordinamento:**
- Coppie complete vengono posizionate insieme
- Single parent union accanto al genitore
- Persone singole alla fine
- Ordinamento cronologico per data di nascita

### GraphService.createUnion(partnerId1, partnerId2, userId)
Crea una Union tra due partner:
- ✅ Previene duplicati automaticamente (cerca union esistente)
- ✅ Normalizza l'ordine dei partner (evita [A,B] vs [B,A])
- ✅ Aggiorna i riferimenti in entrambe le persone

### GraphService.addChildToUnion(unionId, childId)
Aggiunge un figlio a una Union:
- ✅ Aggiunge il figlio alla union
- ✅ Aggiorna automaticamente `parentRefs` del figlio con entrambi i genitori

### GraphService.repairDuplicateUnions(userId)
Utility di manutenzione che:
1. Trova union duplicate (stessi partner)
2. Unisce i figli
3. Aggiorna i riferimenti
4. Elimina i duplicati

## 📡 API Endpoints

### GET /api/tree/:personId
Ottiene il grafo completo centrato su una persona
```javascript
Response: {
  nodes: [
    { _id, firstName, lastName, generation, x, y, kind: 'person', ... },
    { _id, partnerIds, childrenIds, generation, x, y, kind: 'union', ... }
  ],
  edges: [
    { id, from, to, type: 'partner' | 'child' }
  ]
}
```

### POST /api/tree/maintenance/repair-unions
Ripara union duplicate per l'utente corrente
```javascript
Response: {
  message: 'Riparazione completata',
  coppieUnite: 3,
  unionRimosse: 5
}
```

### POST /api/persons/:id/relationship
Aggiunge una relazione tra due persone
```javascript
Request: {
  relatedPersonId: "...",
  relationshipType: "parent" | "child" | "spouse"
}
```

**Comportamento:**
- `spouse`: Crea automaticamente una Union
- `parent`/`child`: Aggiorna `parentRefs` + campi legacy

## 🔄 Migrazione Dati Esistenti

### Script di Migrazione
```bash
node scripts/migrateRelationships.js
```

**Operazioni:**
1. Sincronizza `parentRefs` da `parents` legacy
2. Crea Unions da `spouse` legacy
3. Associa figli comuni alle union
4. Ripara duplicati

### Quando Eseguire
- Dopo l'aggiornamento del codice
- Se si notano duplicati o ghost nodes
- Periodicamente per manutenzione

## 🎯 Best Practices

### Creazione Nuove Persone
```javascript
// ✅ BUONO: Usa createUnion per coppie
await GraphService.createUnion(husband._id, wife._id, userId);

// ✅ BUONO: Usa addChildToUnion per figli
await GraphService.addChildToUnion(union._id, child._id);

// ⚠️ LEGACY: Funziona ma non crea Union
person.parents = [parent1Id, parent2Id];
```

### Aggiornamento Relazioni
```javascript
// ✅ SEMPRE: Usa l'API /relationship
POST /api/persons/:id/relationship
{
  relatedPersonId: "...",
  relationshipType: "spouse"
}
// Questo crea automaticamente la Union
```

### Query del Grafo
```javascript
// ✅ BUONO: Usa sempre getGraph
const { nodes, unions } = await GraphService.getGraph(focusId, userId);
const layout = GraphService.computeLayout(nodes, unions);

// ❌ MALE: Non fare query manuali complesse
```

## 🐛 Risoluzione Problemi

### Problema: Doppi punti/Union duplicate
**Soluzione:**
```bash
curl -X POST http://localhost:5000/api/tree/maintenance/repair-unions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Problema: Genitori non visualizzati
**Causa:** `parentRefs` non sincronizzati
**Soluzione:**
```bash
node scripts/migrateRelationships.js
```

### Problema: Partner non collegati
**Causa:** Union non creata
**Soluzione:** Usa l'API `/relationship` con type `spouse`

## 📊 Differenze con il Vecchio Sistema

| Aspetto | Vecchio | Nuovo |
|---------|---------|-------|
| Union duplicati | ❌ Sì, frequenti | ✅ Prevenuti |
| Ghost nodes | ❌ Sì | ✅ No |
| Virtual unions | ❌ Create sempre | ✅ Solo per fallback legacy |
| Logica BFS | ❌ Complessa (500+ righe) | ✅ Pulita (200 righe) |
| Performance | ⚠️ Query ridondanti | ✅ Ottimizzata |
| Manutenibilità | ❌ Difficile | ✅ Facile |

## 🚀 Prossimi Passi

1. **Test completi:** Testare con alberi genealogici complessi
2. **Frontend:** Aggiornare UI per sfruttare nuovo sistema
3. **Ottimizzazioni:** Cache per grafi già calcolati
4. **Validazioni:** Prevenire relazioni impossibili (es. cicli)

## 📝 Note Tecniche

### Compatibilità
Il sistema mantiene i campi legacy (`parents`, `children`, `spouse`) per garantire che vecchie query continuino a funzionare. Questi campi vengono aggiornati automaticamente insieme al nuovo schema.

### Performance
- Query ottimizzate con `find({ partnerIds: personId })` invece di fetch massivi
- BFS efficiente con Set per visitati
- Layout O(n) dove n = numero di elementi per generazione

### Estendibilità
Il design è facilmente estendibile per:
- Relazioni multiple (divorzi, risposamenti)
- Parentele complesse (adozioni, step-parent)
- Metadata aggiuntive (certezza, note)

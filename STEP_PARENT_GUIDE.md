# 👨‍👩‍👧‍👦 Gestione Famiglie Ricomposte e Step-Parent

## 📋 Problema

Quando crei:
1. **Padre A** (es. Mario)
2. **Figlio B** (es. Giovanni) con genitore biologico A
3. **Partner C** (es. Laura) - secondo matrimonio di A

**Domanda:** Laura diventa automaticamente genitrice di Giovanni?

**Risposta:** NO, e questo è **corretto**! 

## ✅ Comportamento Corretto

Il sistema è progettato per gestire correttamente questi casi:

### Scenario 1: Step-Parent (Genitore acquisito)
```
Mario (padre bio) + Laura (matrigna)
    |
  Giovanni (figlio di Mario, non di Laura)
```

**Come funziona:**
- Giovanni ha `parentRefs: [{ parentId: Mario, type: 'bio' }]`
- Union tra Mario e Laura: `childrenIds: []` (vuoto!)
- Laura è coniuge di Mario ma NON genitrice di Giovanni

### Scenario 2: Famiglia Ricomposta con Figli Comuni
```
Mario (padre) + Laura (madre)
    |                |
Giovanni          Figli comuni
(figlio solo      (figli di
di Mario)         entrambi)
```

**Come funziona:**
- Union1 (Mario + ex): `childrenIds: [Giovanni]`
- Union2 (Mario + Laura): `childrenIds: [figlio_comune]`
- Giovanni: `parentRefs: [{ parentId: Mario, type: 'bio' }]`
- Figlio comune: `parentRefs: [{ parentId: Mario, type: 'bio' }, { parentId: Laura, type: 'bio' }]`

### Scenario 3: Step-Parent che Adotta
```
Mario + Laura
    |
  Giovanni (figlio biologico di Mario, adottato da Laura)
```

**Come funziona:**
- Giovanni: `parentRefs: [
    { parentId: Mario, type: 'bio' },
    { parentId: Laura, type: 'adoptive' }
  ]`
- Union: `childrenIds: [Giovanni]` (perché è figlio della coppia, anche se solo adottivo per Laura)

## 🔧 Come Gestire nei Casi Pratici

### Caso A: Aggiungere un Partner a Qualcuno con Figli

```javascript
// 1. Crea il padre
const mario = new Person({ firstName: 'Mario', ... });
await mario.save();

// 2. Crea il figlio con Mario come genitore
const giovanni = new Person({ 
  firstName: 'Giovanni',
  parentRefs: [{ parentId: mario._id, type: 'bio' }]
});
await giovanni.save();

// 3. Crea la nuova partner
const laura = new Person({ firstName: 'Laura', ... });
await laura.save();

// 4. Crea Union tra Mario e Laura (senza figli!)
const union = await GraphService.createUnion(mario._id, laura._id, userId);
// union.childrenIds = [] (vuoto, corretto!)

// 5. SE Laura adotta Giovanni:
await GraphService.addChildToUnion(union._id, giovanni._id);
// Oppure aggiungi manualmente:
giovanni.parentRefs.push({ parentId: laura._id, type: 'adoptive' });
await giovanni.save();
```

### Caso B: Specificare Figli di una Specifica Union

```javascript
// Coppia con figlio
const padre = await Person.create({ firstName: 'Padre', ... });
const madre = await Person.create({ firstName: 'Madre', ... });
const union = await GraphService.createUnion(padre._id, madre._id, userId);

// Figlio biologico di entrambi
const figlio = await Person.create({
  firstName: 'Figlio',
  parentRefs: [
    { parentId: padre._id, type: 'bio' },
    { parentId: madre._id, type: 'bio' }
  ]
});

// Aggiungi alla Union
await GraphService.addChildToUnion(union._id, figlio._id);
```

### Caso C: Figlio con Step-Parent

```javascript
// Figlio di un solo genitore
const figlio = await Person.create({
  firstName: 'Figlio',
  parentRefs: [
    { parentId: padreId, type: 'bio' }
  ]
});

// Successivamente, se il step-parent adotta:
figlio.parentRefs.push({ 
  parentId: stepParentId, 
  type: 'step'  // o 'adoptive' se adotta legalmente
});
await figlio.save();

// Opzionalmente, aggiungi alla union
const union = await Union.findOne({ partnerIds: { $all: [padreId, stepParentId] } });
if (union && !union.childrenIds.includes(figlio._id)) {
  union.childrenIds.push(figlio._id);
  await union.save();
}
```

## 🎨 Visualizzazione nel Grafo

Il grafo visualizzerà correttamente:

1. **Union senza figli** = coppia senza discendenza
2. **Union con alcuni figli** = solo i figli comuni
3. **Figli con 1 solo genitore** = linea solo verso un partner della coppia

### Esempio Visivo

```
Gen -2:  [Nonno] -- U1 -- [Nonna]
                      |
Gen -1:           [Mario] -- U2 -- [Laura]
                      |              |
Gen 0:          [Giovanni]    [Figlio Comune]
```

- U1: Union nonni -> Mario
- U2: Union Mario + Laura
- Giovanni ha linea solo verso U1 (non è figlio di U2)
- Figlio Comune ha linea verso U2

## 📡 API per Gestire Step-Parent

### Endpoint Esistenti

```javascript
// 1. Creare Union (senza figli)
POST /api/persons/:id/relationship
{
  "relatedPersonId": "partnerId",
  "relationshipType": "spouse"
}
// Crea Union vuota

// 2. Aggiungere tipo di parentela
PUT /api/persons/:childId
{
  "parentRefs": [
    { "parentId": "bioParentId", "type": "bio" },
    { "parentId": "stepParentId", "type": "step" }
  ]
}
```

### Endpoint Consigliato (da creare)

```javascript
// Aggiungere figlio a Union specifica
POST /api/union/:unionId/child
{
  "childId": "...",
  "type": "bio" | "step" | "adoptive"
}
```

## ⚠️ Attenzioni

### ❌ NON Fare (Errore Comune)
```javascript
// SBAGLIATO: Aggiungere automaticamente tutti i figli del partner
const mario = await Person.findById(marioId);
const laura = await Person.findById(lauraId);
const union = await GraphService.createUnion(mario._id, laura._id, userId);

// ❌ SBAGLIATO:
for (const childId of mario.children) {
  await GraphService.addChildToUnion(union._id, childId);
}
// Questo renderebbe Laura genitrice di tutti i figli di Mario!
```

### ✅ Fare Invece
```javascript
// ✅ CORRETTO: Chiedere all'utente quali figli appartengono a questa union
// Mostra UI con lista figli e checkbox:
// "Quali di questi sono figli di entrambi?"
```

## 🔮 Miglioramenti Futuri

### 1. UI per Gestire Figli di Union

Quando crei/modifichi una Union, mostra:
```
Union: Mario + Laura

Figli di Mario:
☐ Giovanni (da precedente relazione)
☐ Marco (da precedente relazione)

Figli comuni:
☑ Luca (figlio di entrambi)
☑ Anna (figlia di entrambi)
```

### 2. Validazione Automatica

```javascript
// Quando aggiungi un figlio a una union, verifica:
function validateChildInUnion(union, childId) {
  const child = await Person.findById(childId);
  const childParents = child.parentRefs.map(r => r.parentId.toString());
  const unionPartners = union.partnerIds.map(p => p.toString());
  
  // Almeno un partner deve essere genitore
  const hasAtLeastOneParent = unionPartners.some(p => childParents.includes(p));
  
  if (!hasAtLeastOneParent) {
    throw new Error('Il figlio deve avere almeno un genitore nella Union');
  }
}
```

### 3. Tipi di Relazione Visibili

Nel grafo, mostrare con colori diversi:
- **Blu solido**: genitore biologico
- **Blu tratteggiato**: genitore adottivo
- **Grigio tratteggiato**: step-parent

## 📚 Riferimenti

- [Person.js](../server/models/Person.js) - Modello con parentRefs
- [Union.js](../server/models/Union.js) - Modello Union con childrenIds
- [graphService.js](../server/services/graphService.js) - createUnion e addChildToUnion
- [RELATIONSHIP_SYSTEM.md](./RELATIONSHIP_SYSTEM.md) - Documentazione completa

## 🎯 Conclusione

Il sistema è **progettato correttamente** per gestire famiglie ricomposte:

✅ Union non aggiunge automaticamente i figli dei partner
✅ Supporta diversi tipi di parentela (bio, step, adoptive, foster)
✅ Permette di specificare esplicitamente i figli di ogni Union
✅ Visualizza correttamente nel grafo le relazioni complesse

Il comportamento attuale è **quello desiderato** e rispetta la realtà delle famiglie moderne.

# 🌳 Sistema di Gestione Parentele - Guida Rapida

## ✨ Cosa è Cambiato?

Il sistema di gestione delle relazioni genealogiche è stato **completamente riscritto da zero** per eliminare:
- ✅ Union duplicate (doppi punti nel grafo)
- ✅ Ghost nodes (nodi fantasma)
- ✅ Complessità inutile

## 🚀 Avvio Rapido

### 1️⃣ Installa Dipendenze (se necessario)
```bash
npm install
```

### 2️⃣ Esegui la Migrazione dei Dati
**⚠️ IMPORTANTE: Fai un backup del database prima!**

```bash
# Backup (MongoDB)
mongodump --uri="mongodb://localhost:27017/genealogy" --out=./backup

# Esegui migrazione
node scripts/migrateRelationships.js
```

### 3️⃣ Testa il Sistema
```bash
# Test automatici
node scripts/testGraphSystem.js

# Se i test passano, avvia il server
npm start
```

### 4️⃣ Ripara Duplicati (se presenti)
```bash
curl -X POST http://localhost:5000/api/tree/maintenance/repair-unions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📖 Uso del Nuovo Sistema

### Aggiungere una Coppia
```javascript
// Automatico tramite API
POST /api/persons/:personId/relationship
{
  "relatedPersonId": "...",
  "relationshipType": "spouse"
}
// Questo crea automaticamente la Union!
```

### Aggiungere un Figlio
```javascript
// Metodo 1: Tramite API relationship
POST /api/persons/:parentId/relationship
{
  "relatedPersonId": "childId",
  "relationshipType": "child"
}

// Metodo 2: Programmaticamente
const union = await GraphService.createUnion(parent1Id, parent2Id, userId);
await GraphService.addChildToUnion(union._id, childId);
```

### Ottenere il Grafo
```javascript
// Tramite API
GET /api/tree/:personId

// Risposta
{
  "nodes": [
    { "_id": "...", "firstName": "Mario", "kind": "person", "generation": 0, "x": 100, "y": 200 },
    { "_id": "...", "partnerIds": [...], "kind": "union", "generation": 0, "x": 150, "y": 200 }
  ],
  "edges": [
    { "id": "...", "from": "personId", "to": "unionId", "type": "partner" },
    { "id": "...", "from": "unionId", "to": "childId", "type": "child" }
  ]
}
```

## 🔧 Manutenzione

### Riparare Duplicati
Se vedi doppi punti nel grafo:
```bash
POST /api/tree/maintenance/repair-unions
```

### Re-sincronizzare Dati
Se le relazioni sembrano incomplete:
```bash
node scripts/migrateRelationships.js
```

## 📚 Documentazione Completa

- [RELATIONSHIP_SYSTEM.md](./RELATIONSHIP_SYSTEM.md) - Documentazione dettagliata
- [CHANGELOG_RELATIONSHIPS.md](./CHANGELOG_RELATIONSHIPS.md) - Log delle modifiche

## ❓ FAQ

### Q: Il mio grafo mostra duplicati?
**A:** Esegui l'endpoint di riparazione: `POST /api/tree/maintenance/repair-unions`

### Q: I genitori non appaiono nel grafo?
**A:** Esegui lo script di migrazione: `node scripts/migrateRelationships.js`

### Q: Come creo una coppia senza figli?
**A:** Usa l'API `/relationship` con type `spouse`. La Union verrà creata automaticamente.

### Q: Posso ancora usare i campi legacy (parents, children, spouse)?
**A:** Sì! Il sistema li mantiene sincronizzati automaticamente con il nuovo schema.

### Q: Cosa succede se elimino una persona?
**A:** Tutte le Union associate vengono automaticamente eliminate, prevenendo ghost nodes.

## 🐛 Problemi Comuni

### Errore: "Union not found"
**Causa:** Union non creata correttamente  
**Soluzione:** Usa `GraphService.createUnion()` o l'API `/relationship`

### Errore: "Duplicate key error"
**Causa:** Tentativo di creare union duplicata  
**Soluzione:** Il sistema previene automaticamente, verifica la logica

### Ghost nodes nel grafo
**Causa:** Dati inconsistenti  
**Soluzione:** Esegui `node scripts/migrateRelationships.js`

## 💡 Best Practices

1. **Sempre usare le API** invece di modificare direttamente il DB
2. **Eseguire il backup** prima di operazioni massicce
3. **Testare in staging** prima di produzione
4. **Eseguire la migrazione** dopo ogni aggiornamento
5. **Monitorare i log** per eventuali warning

## 🎯 Prossimi Passi

1. ✅ Sistema core funzionante
2. 🔄 Test con dati reali
3. 📊 Dashboard di monitoraggio (opzionale)
4. 🌐 Aggiornamenti frontend (se necessario)
5. 📈 Ottimizzazioni performance (cache)

---

**Supporto:** Consulta [RELATIONSHIP_SYSTEM.md](./RELATIONSHIP_SYSTEM.md) per dettagli completi

**Versione:** 2.0.0  
**Ultimo aggiornamento:** 2 Febbraio 2026

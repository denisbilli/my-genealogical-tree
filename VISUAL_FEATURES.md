# Guida alle Funzionalità Visive per Famiglie Ricomposte

## Panoramica
Il sistema ora visualizza graficamente i diversi tipi di parentela nel grafo genealogico, permettendo di gestire famiglie ricomposte (step-families) in modo completo.

---

## 🎨 Colori e Stili delle Linee

### Linee Partner
- **Colore**: Rosa (`#ec4899`)
- **Stile**: Linea dritta e spessa (3px)
- **Significato**: Collegamento tra partner di una Union

### Linee Figli

#### 1. **Figlio Biologico**
- **Colore**: Blu (`#3b82f6`)
- **Stile**: Linea solida curva
- **Quando appare**: Quando ENTRAMBI i partner della Union sono genitori biologici del figlio

#### 2. **Figlio Acquisito (Step-child)**
- **Colore**: Arancione (`#f59e0b`)
- **Stile**: Linea tratteggiata (dash 6,4)
- **Quando appare**: Quando SOLO UNO dei partner è genitore biologico del figlio

#### 3. **Figlio Adottivo**
- **Colore**: Verde (`#10b981`)
- **Stile**: Linea tratteggiata (dash 3,3)
- **Quando appare**: Quando entrambi i partner hanno adottato il figlio

#### 4. **Figlio in Affidamento**
- **Colore**: Viola (`#8b5cf6`)
- **Stile**: Linea tratteggiata (dash 8,4)
- **Quando appare**: Quando il figlio è in affidamento presso la coppia

---

## 🔵 Nodi Union

### Aspetto Visivo
- **Forma**: Cerchio rosa più grande (20px)
- **Colore**: Rosa intenso (`#ec4899`)
- **Bordo**: Bianco spesso (3px) con ombra
- **Interattività**: 
  - Hover: Si ingrandisce del 20% con ombra rosa
  - Click: Apre il modal di gestione Union

### Come Funzionano
I nodi Union rappresentano una coppia (partner). Cliccando su un nodo Union puoi:
1. Vedere i partner della Union
2. Vedere i figli già assegnati a questa Union
3. Aggiungere nuovi figli alla Union
4. Rimuovere figli dalla Union
5. Specificare il tipo di parentela per ogni figlio

---

## 📋 Legenda Grafica

Nell'angolo in alto a sinistra del grafo è presente una legenda interattiva che mostra:
- Rosa solida: Partner
- Blu solida: Figlio biologico
- Arancione tratteggiata: Figlio acquisito
- Verde tratteggiata: Figlio adottivo
- Viola tratteggiata: Figlio in affido

---

## 🛠️ Modal di Gestione Union

### Apertura
Clicca su qualsiasi **nodo Union (cerchio rosa)** nel grafo.

### Contenuto del Modal

#### Sezione 1: Partner
Mostra i due partner della Union con foto e nome.

#### Sezione 2: Figli Attuali
Lista di tutti i figli già assegnati a questa Union:
- Foto e nome del figlio
- Indicatore del tipo di parentela (🔵 Biologico, 🟠 Acquisito, 🟢 Adottivo, 🟣 Affido)
- Pulsante per rimuovere il figlio dalla Union

#### Sezione 3: Aggiungi Figlio
- **Dropdown**: Seleziona uno dei "figli potenziali"
  - Un figlio è "potenziale" se almeno uno dei partner è suo genitore ma il figlio non è ancora nella Union
- **Radio buttons**: Scegli il tipo di parentela
  - Biologico: ENTRAMBI i partner sono genitori biologici
  - Acquisito: SOLO UNO dei partner è genitore biologico (step-parent)
  - Adottivo: Figlio adottato dalla coppia
  - Affido: Figlio in affidamento
- **Pulsante "Aggiungi figlio"**: Conferma l'operazione

---

## 💡 Casi d'Uso Tipici

### Caso 1: Famiglia Nucleare Semplice
**Scenario**: Mario e Lucia hanno due figli biologici (Anna e Paolo)

**Setup**:
1. Crea Mario, Lucia, Anna, Paolo
2. Aggiungi Lucia come partner di Mario → crea automaticamente una Union
3. Clicca sulla Union (cerchio rosa)
4. Aggiungi Anna come "Biologico" alla Union
5. Aggiungi Paolo come "Biologico" alla Union

**Risultato Visivo**:
- Mario ←—(rosa)—→ Union ←—(rosa)—→ Lucia
- Union ←—(blu solida)—→ Anna
- Union ←—(blu solida)—→ Paolo

---

### Caso 2: Famiglia Ricomposta (Blended Family)
**Scenario**: 
- Marco ha una figlia (Sara) dalla precedente moglie
- Marco sposa Giulia
- Sara NON è figlia biologica di Giulia

**Setup**:
1. Crea Marco con figlia Sara
2. Crea Giulia e aggiungila come partner di Marco → Union creata
3. Clicca sulla Union
4. Aggiungi Sara come "**Acquisito**" (step-child)

**Risultato Visivo**:
- Marco ←—(rosa)—→ Union ←—(rosa)—→ Giulia
- Union ←—(arancione tratteggiata)—→ Sara

**Spiegazione**: La linea arancione tratteggiata indica che Sara è figlia biologica di Marco ma step-daughter di Giulia.

---

### Caso 3: Famiglia Ricomposta Complessa
**Scenario**:
- Francesco ha un figlio (Luca) dalla precedente moglie
- Elena ha una figlia (Marta) dal precedente marito
- Francesco e Elena si sposano
- Francesco ed Elena hanno insieme un figlio (Tommaso)

**Setup**:
1. Crea Francesco con figlio Luca
2. Crea Elena con figlia Marta
3. Aggiungi Elena come partner di Francesco → Union creata
4. Crea Tommaso come figlio di Francesco (automaticamente andrà in parentRefs)
5. Clicca sulla Union
6. Aggiungi Luca come "**Acquisito**" (è figlio bio di Francesco, step-son di Elena)
7. Aggiungi Marta come "**Acquisito**" (è figlia bio di Elena, step-daughter di Francesco)
8. Aggiungi Tommaso come "**Biologico**" (è figlio di entrambi)

**Risultato Visivo**:
- Francesco ←—(rosa)—→ Union ←—(rosa)—→ Elena
- Union ←—(arancione tratteggiata)—→ Luca
- Union ←—(arancione tratteggiata)—→ Marta
- Union ←—(blu solida)—→ Tommaso

---

### Caso 4: Adozione
**Scenario**: Giorgio e Laura adottano un bambino (Andrea)

**Setup**:
1. Crea Giorgio e Laura
2. Aggiungi Laura come partner di Giorgio → Union creata
3. Crea Andrea (senza genitori biologici)
4. Aggiungi manualmente Giorgio e Laura come genitori adottivi di Andrea:
   - Vai in modifica di Andrea
   - Aggiungi i parentRefs con type "adoptive"
5. Clicca sulla Union
6. Aggiungi Andrea come "**Adottivo**"

**Risultato Visivo**:
- Giorgio ←—(rosa)—→ Union ←—(rosa)—→ Laura
- Union ←—(verde tratteggiata)—→ Andrea

---

## 🔧 Logica Tecnica

### Come il Backend Determina il Tipo di Parentela
Quando crea gli edge nel grafo, il sistema:

1. **Per ogni figlio di una Union**:
   - Esamina i `parentRefs` del figlio
   - Verifica il tipo di parentela con ciascun partner della Union
   
2. **Classificazione**:
   - **Biologico**: Se ENTRAMBI i partner hanno type='bio'
   - **Acquisito**: Se UNO ha type='bio' e l'altro ha type='step' (o manca)
   - **Adottivo**: Se entrambi hanno type='adoptive'
   - **Affido**: Se c'è type='foster'

3. **Edge Rendering**:
   - L'informazione `parentalType` viene passata nel campo `edge.parentalType`
   - Il frontend usa questo campo per scegliere colore e stile della linea

---

## 📊 API Endpoints per Union

### GET `/api/tree/unions/all`
Restituisce tutte le Union del database.

### GET `/api/tree/union/:unionId/potential-children`
Restituisce i figli "potenziali" di una Union:
- Figli che hanno almeno uno dei partner come genitore
- Ma che NON sono ancora nella `childrenIds` della Union

### POST `/api/tree/union/:unionId/child`
Aggiunge un figlio a una Union.

**Body**:
```json
{
  "childId": "...",
  "type": "bio" | "step" | "adoptive" | "foster"
}
```

**Effetto**:
- Aggiunge `childId` a `union.childrenIds`
- Aggiorna i `parentRefs` del figlio con il tipo specificato per entrambi i partner

### DELETE `/api/tree/union/:unionId/child/:childId`
Rimuove un figlio da una Union.

**Effetto**:
- Rimuove `childId` da `union.childrenIds`
- NON rimuove i parentRefs (per preservare la storia genealogica)

---

## 🎯 Best Practices

### 1. Ordine di Creazione
Per evitare confusione, segui questo ordine:
1. Crea le persone (genitori e figli)
2. Aggiungi i partner (questo crea le Union)
3. Assegna i figli alle Union tramite il modal

### 2. Figli di Famiglie Precedenti
Se una persona ha figli da un precedente matrimonio:
- I figli saranno automaticamente collegati al genitore biologico
- Quando aggiungi un nuovo partner, clicca sulla Union e aggiungi i figli come "Acquisiti"

### 3. Figli Biologici Comuni
Se una coppia ha figli biologici insieme:
- Crea il figlio con uno dei genitori
- Clicca sulla Union
- Aggiungi il figlio come "Biologico" alla Union
- Il sistema aggiornerà automaticamente i parentRefs per entrambi i genitori

### 4. Visualizzazione Complessa
Per alberi molto grandi:
- Usa i controlli di zoom (+ / - / R) in alto a destra
- Trascina per navigare
- La legenda aiuta a interpretare i diversi tipi di relazione

---

## 🐛 Troubleshooting

### Problema: "Non vedo l'opzione per aggiungere un figlio alla Union"
**Causa**: Non ci sono figli "potenziali"
**Soluzione**: Assicurati che almeno uno dei partner abbia figli non ancora assegnati a questa Union

### Problema: "Le linee hanno il colore sbagliato"
**Causa**: I parentRefs potrebbero non essere impostati correttamente
**Soluzione**: 
1. Verifica i parentRefs del figlio nel database
2. Assicurati che il tipo sia 'bio', 'step', 'adoptive' o 'foster'
3. Ricarica la pagina

### Problema: "Il nodo Union non è cliccabile"
**Causa**: Problema con il rendering
**Soluzione**: Ricarica la pagina. Il nodo Union dovrebbe diventare rosa intenso e ingrandirsi al passaggio del mouse.

---

## 📝 Prossimi Sviluppi

Funzionalità in programma:
- Tooltip sui nodi Union che mostrano i nomi dei partner
- Filtro per tipo di parentela (mostra solo figli biologici, ecc.)
- Export del grafo in formato immagine/PDF
- Visualizzazione delle Union precedenti (matrimoni terminati)
- Gestione delle date di inizio/fine delle Union

---

## 📚 Riferimenti Tecnici

### File Coinvolti
- **Backend**:
  - `server/services/graphService.js`: Logica di determinazione del tipo di parentela
  - `server/routes/tree.js`: Endpoint API per Union
  
- **Frontend**:
  - `client/src/pages/TreeView.jsx`: Rendering del grafo e legenda
  - `client/src/components/NodeCard.jsx`: Rendering nodi Person e Union
  - `client/src/components/UnionModal.jsx`: Modal di gestione Union

### Modelli
- `server/models/Person.js`: Campo `parentRefs` con tipo di parentela
- `server/models/Union.js`: Campi `partnerIds` e `childrenIds`

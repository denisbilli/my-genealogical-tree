# 🔍 Debugging: Problema "Vedo solo un nodo"

## Situazione
Il backend funziona correttamente e restituisce 20 nodi, ma il frontend mostra solo 1 nodo.

## Verifiche Effettuate ✅

1. **Backend API** - ✅ FUNZIONA
   - getGraph() restituisce 11 persone
   - computeLayout() genera 20 nodi (persone + union)
   - 14 edges creati correttamente

2. **Database** - ✅ POPOLATO
   - 11 persone presenti
   - 5 Union create dalla migrazione
   - parentRefs sincronizzati

3. **Migrazione** - ✅ COMPLETATA
   - Union create da spouse legacy
   - parentRefs sincronizzati
   - Nessun duplicato

## Possibili Cause 🔎

### 1. Cache del Browser
Il browser potrebbe avere in cache la vecchia versione del JavaScript.

**Soluzione:**
- Apri DevTools (F12)
- Vai su Network tab
- Abilita "Disable cache"
- Ricarica con Ctrl+Shift+R (hard refresh)

### 2. Errore JavaScript nel Frontend
Il frontend potrebbe avere un errore che impedisce il rendering.

**Debug:**
1. Apri la console del browser (F12)
2. Cerca errori in rosso
3. Controlla i network requests per `/api/tree/:id`

### 3. Problema nel TreeView Component

Il componente potrebbe non gestire correttamente i dati.

**Verifica:**
```javascript
// Aggiungi questi console.log in TreeView.jsx:

const loadTree = async (focusId) => {
    console.log('🔍 Loading tree for:', focusId);
    const res = await personService.getTree(focusId);
    console.log('📦 Raw response:', res.data);
    console.log('📊 Nodes count:', res.data.nodes?.length);
    console.log('📊 Edges count:', res.data.edges?.length);
    setTreeLayout(res.data);
};
```

### 4. Filtro o Condizione nel Rendering

Potrebbe esserci un filtro che mostra solo alcuni nodi.

**Verifica:**
- Cerca `.filter()` nel codice
- Controlla condizioni `if` nel render dei nodi
- Verifica che tutti i nodi abbiano `x` e `y` validi

## Test Rapido 🧪

### Opzione A: Browser DevTools
1. Apri http://localhost:5173 (o la tua porta Vite)
2. Apri DevTools (F12)
3. Console tab
4. Esegui:
```javascript
// Simula caricamento
fetch('/api/tree/6981125d5e842c22a45b90c2', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
})
.then(r => r.json())
.then(data => {
  console.log('Nodes:', data.nodes.length);
  console.log('Edges:', data.edges.length);
  console.table(data.nodes.map(n => ({
    kind: n.kind,
    name: n.firstName || 'Union',
    x: n.x,
    y: n.y,
    gen: n.generation
  })));
});
```

### Opzione B: Test Page
1. Apri http://localhost:5173/test-tree.html
2. Clicca "Test API"
3. Verifica quanti nodi vengono restituiti

### Opzione C: Network Tab
1. Apri DevTools
2. Network tab
3. Ricarica la pagina
4. Cerca richiesta a `/api/tree/...`
5. Clicca sulla richiesta
6. Preview tab - verifica `nodes.length`

## Fix Comuni 🔧

### Se vedi errori CORS:
Il server è configurato con CORS, non dovrebbe essere un problema.

### Se vedi 401 Unauthorized:
Il token JWT è scaduto o non valido.
- Fai logout e login di nuovo
- Controlla localStorage.getItem('token')

### Se l'API restituisce dati ma il render mostra 1 nodo:
Probabilmente c'è un problema nel rendering. Controlla:

```jsx
// In TreeView.jsx, sezione render dei nodi:
{treeLayout.nodes.map((node) => {
    console.log('Rendering node:', node.kind, node.firstName || node._id);
    
    if (node.kind === 'person') {
        // Renderizza persona
    } else if (node.kind === 'union') {
        // Renderizza union
    }
})}
```

### Se vedi "x: null" negli union:
Già fixato nel backend. Restart del container:
```bash
docker-compose restart app
```

## Prossimi Passi 📝

1. **Verifica immediata**: Apri DevTools e controlla la console per errori
2. **Test API**: Usa il test-tree.html per verificare l'API
3. **Controlla Network**: Verifica che l'API restituisca effettivamente 20 nodi
4. **Aggiungi logging**: Se necessario, aggiungi console.log nel TreeView

## Comandi Utili 💻

```bash
# Restart containers
docker-compose restart app

# Vedi log del server
docker-compose logs app --tail=50

# Test API da terminale
./test-api.sh

# Rebuild completo
docker-compose down && docker-compose up --build -d
```

## Debug Avanzato 🔬

Se tutto il resto fallisce, aggiungi logging dettagliato:

```jsx
// In TreeView.jsx, dopo setTreeLayout:
useEffect(() => {
  console.log('🎨 TreeLayout updated:', {
    nodesCount: treeLayout.nodes?.length,
    edgesCount: treeLayout.edges?.length,
    nodes: treeLayout.nodes
  });
}, [treeLayout]);
```

---

**Nota:** Il backend è stato completamente riscritto e funziona correttamente. Il problema è molto probabilmente nel frontend o nella cache del browser.

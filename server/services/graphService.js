const Person = require('../models/Person');
const Union = require('../models/Union');

/**
 * GRAPH SERVICE - Gestione pulita e robusta delle relazioni genealogiche
 * Riscrittura completa per eliminare duplicati, ghost nodes e complessità inutile
 */
class GraphService {
    static NODE_WIDTH = 250;
    static NODE_HEIGHT = 100;
    static X_SPACING = 300;
    static Y_SPACING = 200;

    /**
     * Crea o recupera una Union tra due persone
     */
    static async createUnion(partnerId1, partnerId2, userId) {
        // Normalizza l'ordine dei partner per evitare duplicati
        const partnerIds = [partnerId1, partnerId2].sort();
        
        // Cerca union esistente
        let union = await Union.findOne({
            userId,
            partnerIds: { $all: partnerIds, $size: 2 }
        });

        if (union) return union;

        // Crea nuova union
        union = new Union({
            partnerIds,
            userId,
            type: 'relationship',
            childrenIds: []
        });
        await union.save();

        // Aggiorna i riferimenti nelle persone
        await Person.updateMany(
            { _id: { $in: partnerIds } },
            { $addToSet: { unionIds: union._id } }
        );

        return union;
    }

    /**
     * Aggiunge un figlio a una Union
     */
    static async addChildToUnion(unionId, childId) {
        const union = await Union.findById(unionId);
        if (!union) throw new Error('Union non trovata');

        const child = await Person.findById(childId);
        if (!child) throw new Error('Figlio non trovato');

        // Aggiungi figlio alla union (se non già presente)
        if (!union.childrenIds.some(id => id.toString() === childId.toString())) {
            union.childrenIds.push(childId);
            await union.save();
        }

        // Aggiungi i genitori al figlio (entrambi i partner della union)
        for (const parentId of union.partnerIds) {
            const alreadyExists = child.parentRefs.some(
                ref => ref.parentId.toString() === parentId.toString()
            );
            
            if (!alreadyExists) {
                child.parentRefs.push({
                    parentId,
                    type: 'bio'
                });
            }
        }

        await child.save();
        return union;
    }

    /**
     * Costruisce il grafo genealogico completo centrato su una persona
     * NUOVA LOGICA: Focus-Centric
     * Mostra il focus, i suoi parenti diretti (genitori, figli, partner).
     * Tutto il resto è nascosto a meno che non sia specificato in "expandedIds".
     * Restituisce meta-dati per i nodi di confine per mostrare i badge.
     * 
     * @param {string} focusId - ID della persona focus
     * @param {string} userId - ID dell'utente
     * @param {Object} config - { expandedIds: [] }
     * @returns {Object} { nodes, unions }
     */
    static async getGraph(focusId, userId, config = { expandedIds: [] }) {
        const nodesMap = new Map();
        const unionsMap = new Map();
        const visited = new Set();
        
        // Set di ID esplicitamente espansi dall'utente
        const expandedSet = new Set((config.expandedIds || []).map(id => id.toString()));
        // Il focus è sempre "espanso" nel senso che vediamo i suoi vicini
        expandedSet.add(focusId.toString());

        // Queue per BFS: { personId, generation, sourceId }
        // sourceId è il nodo da cui arriviamo. Se sourceId è "espanso", carichiamo questo nodo.
        // Se questo nodo NON è "espanso", ci fermiamo qui (diventa un nodo foglia visuale), controllando solo se ha ulteriori connessioni.
        const queue = [{ personId: focusId.toString(), generation: 0, sourceIsExpanded: true }];

        // Cache veloce per lookup genitori/figli per i contatori
        // Non possiamo fare query per ogni nodo foglia, sarebbe lento.
        // Strategia: Carichiamo "un po' di più" o facciamo query mirate aggregate?
        // Per ora facciamo query puntuali ottimizzate o ci affidiamo al fatto che carichiamo i dati della persona.
        
        while (queue.length > 0) {
            const { personId, generation, sourceIsExpanded } = queue.shift();
            
            if (visited.has(personId)) continue;
            // Se la sorgente non era espansa, non dovremmo nemmeno essere qui, 
            // a meno che questo nodo non sia stato raggiunto per altra via.
            // Ma per sicurezza processiamo.
            
            visited.add(personId);

            // Carica la persona
            const person = await Person.findOne({ _id: personId, userId });
            if (!person) continue;

            const isExpanded = expandedSet.has(personId);

            // Calcola i contatori per i badge (Parenti/Figli)
            // Nota: Queste info sono parzialmente nell'oggetto person (parents, children legacy o parentRefs, unionIds)
            // Dobbiamo sapere quanti di questi NON sono già nel grafo visualizzato.
            // Poiché stiamo costruendo il grafo ora, è difficile saperlo in anticipo.
            // Soluzione: Carichiamo tutto ciò che è direttamente connesso.
            // Se `isExpanded` è false, non aggiungiamo quei vicini alla coda BFS, ma li contiamo.

            const nodeData = {
                ...person.toObject(),
                _id: personId,
                generation,
                kind: 'person',
                isExpanded, // Flag frontend
                // Counters placeholder
                badgeAncestors: 0,
                badgeDescendants: 0
            };
            
            nodesMap.set(personId, nodeData);

            // Se il nodo da cui arriviamo NON era espanso, questo nodo è un "terminale" visivo.
            // Non esploriamo i suoi vicini, MA dobbiamo contarli per i badge.
            // Però aspetta: se io sono il figlio di un nodo non espanso...
            // La logica corretta è: 
            // Espando i vicini SOLO SE `isExpanded` è true.
            
            // Recupera TUTTI i parenti potenziali per contarli
            const parentIds = this._getParentIds(person);
            
            // Recupera TUTTE le unioni (per partner e figli)
            const personUnions = await Union.find({ userId, partnerIds: personId });
            
            // Calcolo Badge Ancestors
            // Un antenato contribuisce al badge se NON è stato visitato E non verrà visitato (cioè non è in queue)
            // O più semplicemente: se NON carichiamo questo ramo, il badge è il numero totale di genitori.
            if (!isExpanded) {
                // Se non espando, tutti i genitori sono "nascosti" (eccetto forse quello da cui arrivo, se arrivo da sopra)
                // Ma per semplicità, il badge indica "ci sono cose di là".
                // Raffinamento: escludiamo dal conteggio il nodo da cui siamo arrivati nella BFS? 
                // Troppo complesso tracciare la direzione.
                // Semplificazione: Badge = Count(Parents) - Count(VisibleParents)
                // Lo calcoliamo alla fine del ciclo while per esattezza.
            } else {
                // Se espanso, aggiungi genitori alla coda
                for (const pid of parentIds) {
                    if (!visited.has(pid)) {
                        queue.push({ personId: pid, generation: generation - 1, sourceIsExpanded: true });
                    }
                }
            }

            // Gestione Discendenti e Partner (Unions)
            let totalChildrenCount = 0;
            
            for (const union of personUnions) {
                const unionId = union._id.toString();
                
                // I partner vengono visualizzati sempre se il nodo è visibile? 
                // Diciamo di sì, il partner fa parte del nucleo.
                // Oppure: mostriamo partner solo se c'è connessione rilevante?
                // Nel design "Family Tree", vedere i partner è standard.
                
                // Se il nodo è espanso, carichiamo le unioni e i figli
                // Se il nodo NON è espanso, dobbiamo contare i figli per il badge e mostrare i partner?
                // Dubbio: se ho 3 mogli e sono "chiuso", vedo le 3 mogli?
                // Proposta: Se chiuso, vedo solo la linea diretta (se arrivo da figlio/partner).
                // Se sono il focus, vedo tutto.
                
                // Semplificazione richiesta utente: "Visualizzare/nascondere ramificazioni".
                // Facciamo che se non è espanso, non mostriamo né partner né figli (eccetto quello di provenienza).
                // MA i partner sono cruciali per visualizzare i figli.
                // Compromesso: Se non espanso, NON mostriamo figli. I partner li mostriamo solo se servono (es. link grafico).
                // Ma per ora lasciamo i partner visibili sulla riga della generazione, occupa poco spazio.

                // Includiamo la union se:
                // 1. Il nodo corrente è espanso.
                // 2. Uno dei figli della union è già stato visitato (i.e. stiamo risalendo dal figlio al genitore).
                // 3. SEMPRE? Mostrare i partner è fondamentale per capire il contesto, occupano poco spazio orizzontale.
                //    Se nascondiamo i partner, l'albero sembra "single parent".
                
                // DECISIONE: Mostriamo sempre le unions (quindi i partner), ma NON carichiamo i figli se non espanso.
                // Questo risolve "vedo mio nonno ma non vedo mia nonna".
                const shouldShowUnion = true; // Semplificazione drastica ma efficace.
                
                // Calcoliamo isLegacyConnection per sapere se mostrare i figli anche se non espanso
                const isLegacyConnection = union.childrenIds.some(cid => visited.has(cid.toString()));

                if (shouldShowUnion) {
                    if (!unionsMap.has(unionId)) {
                        unionsMap.set(unionId, {
                            _id: unionId,
                            partnerIds: union.partnerIds.map(id => id.toString()),
                            childrenIds: union.childrenIds.map(id => id.toString()),
                            type: union.type,
                            generation,
                            kind: 'union'
                        });
                    }

                    // Aggiungi partner (stessa gen)
                    union.partnerIds.forEach(pid => {
                        const pStr = pid.toString();
                        if (pStr !== personId && !visited.has(pStr)) {
                             queue.push({ personId: pStr, generation, sourceIsExpanded: false });
                        }
                    });

                    // Aggiungi figli (gen + 1)
                    // SOLO se il nodo è espanso, oppure se stiamo tracciando una connessione già esistente (Legacy).
                    // Se mostriamo solo il partner per completezza (shouldShowUnion=true ma !isExpanded), NON dobbiamo scendere nei figli.
                    if (isExpanded || isLegacyConnection) {
                        union.childrenIds.forEach(cid => {
                            const cStr = cid.toString();
                            if (!visited.has(cStr)) {
                                queue.push({ personId: cStr, generation: generation + 1, sourceIsExpanded: isExpanded });
                            }
                        });
                    }
                }
                
                // Conteggi per badge
                totalChildrenCount += union.childrenIds.length;
            }
            
            // Store raw counts for post-processing
            nodeData._rawParentIds = parentIds;
            nodeData._rawTotalChildren = totalChildrenCount; // Approx, duplicates possible across unions? No, children unique to union usually.
        }

        // POST-PROCESSING: Calcolo Badge
        // Ora sappiamo esattamente quali nodi sono in `nodesMap`. (E `unionsMap`)
        // Dobbiamo re-iterare `nodesMap` per calcolare i badge correttamente
        const nodesArray = Array.from(nodesMap.values());
        
        for (const node of nodesArray) {
             // 1. Calcolo Ancestors Hidden Badge
             // Quanti genitori NON sono presenti nella nodesMap?
             const visibleParentsCount = node._rawParentIds.filter(pid => nodesMap.has(pid)).length;
             node.badgeAncestors = Math.max(0, node._rawParentIds.length - visibleParentsCount);

             // 2. Calcolo Descendants Hidden Badge
             // Quanti figli NON sono presenti nella nodesMap?
             // Dobbiamo sapere quanti figli totali ha (che è _rawTotalChildren, ma attento a legacy e overlap).
             // Per sicurezza diciamo che _rawTotalChildren è affidabile (somma size childrenIds di tutte le unions).
             
             // Cerchiamo i figli visibili
             // Un nodo N è figlio visibile di node se:
             // - N è in nodesMap
             // - Una union in unionsMap (quindi visibile) collega node -> N
             // OPPURE 
             // - N ha node come genitore (metodo robusto)
             
             // Metodo robusto: scansiona tutti i nodi visibili e conta quanti dicono "il mio genitore è node._id"
             let visibleChildrenCount = 0;
             for (const potentialChild of nodesArray) {
                 // Controlla se 'potentialChild' ha 'node._id' tra i suoi genitori
                 // Usiamo i dati grezzi salvati in _rawParentIds se disponibili, altrimenti ricalcoliamo
                 // Ma _rawParentIds sono stringhe ID
                 if (potentialChild._rawParentIds && potentialChild._rawParentIds.includes(node._id.toString())) { // FIX: toString() check
                     visibleChildrenCount++;
                 }
             }
             
             // Se HO figli visibili (visibleChildrenCount > 0), allora considero il nodo come "aperto verso il basso"
             // anche se in expandedIds non c'era lui ma il suo partner.
             // Questo flag aiuta il frontend a decidere se mostrare il pulsante "Nascondi" o il badge "+".
             node.hasVisibleChildren = visibleChildrenCount > 0;
             
             // Il badge conta solo quelli propriamente nascosti
             node.badgeDescendants = Math.max(0, node._rawTotalChildren - visibleChildrenCount);

             // Cleanup helper props
             delete node._rawParentIds;
             delete node._rawTotalChildren;
        }

        return {
            nodes: nodesArray,
            unions: Array.from(unionsMap.values())
        };
    }

    /**
     * Calcola il layout (posizioni X, Y) per il grafo
     */
    static computeLayout(nodes, unions) {
        // Organizza per generazione
        const generations = new Map(); // generation -> items[]
        
        nodes.forEach(node => {
            if (!generations.has(node.generation)) {
                generations.set(node.generation, []);
            }
            generations.get(node.generation).push(node);
        });

        unions.forEach(union => {
            if (!generations.has(union.generation)) {
                generations.set(union.generation, []);
            }
            generations.get(union.generation).push(union);
        });

        const finalNodes = [];
        const edges = [];

        // Ordina le generazioni
        const sortedGens = Array.from(generations.keys()).sort((a, b) => a - b);

        for (const gen of sortedGens) {
            const items = generations.get(gen);
            
            // Separa persone e unions
            const persons = items.filter(i => i.kind === 'person');
            const genUnions = items.filter(i => i.kind === 'union');
            
            // Crea strutture di coppia per ordinamento intelligente
            const couples = this._buildCouples(persons, genUnions);
            
            // MODIFICA: Usa ordinamento basato sulla famiglia (ancestry) invece che solo data
            const ordered = this._orderItemsByFamily(couples, finalNodes);

            // MODIFICA LAYOUT: Calcolo larghezza basato solo sulle persone per avvicinarle
            // Le Union non occupano uno spazio intero "nella griglia" ma stanno tra le persone
            const personsInGen = ordered.filter(i => i.kind === 'person');
            const personCount = personsInGen.length;
            // Se ci sono persone, la larghezza è data dagli intervalli tra loro
            const effectiveWidth = Math.max(0, personCount - 1) * this.X_SPACING;
            
            let currentX = -effectiveWidth / 2;

            ordered.forEach((item, index) => {
                // Assegna Y
                item.y = gen * this.Y_SPACING;

                // Assegna X
                if (item.kind === 'person') {
                    item.x = currentX;
                    currentX += this.X_SPACING;
                } else {
                    // Union: posizione temporanea
                    item.x = currentX - (this.X_SPACING / 2);
                }

                finalNodes.push(item);
            });

            // SECONDO PASSAGGIO: Centra le unions tra i partner
            // Ora che tutti i nodi della generazione hanno X assegnato
            ordered.filter(i => i.kind === 'union').forEach(unionNode => {
                const partners = unionNode.partnerIds
                    .map(id => {
                        const idStr = id.toString();
                        return finalNodes.find(n => n._id.toString() === idStr);
                    })
                    .filter(Boolean);

                if (partners.length === 2) {
                     // Ensure both partners have valid X
                     if (typeof partners[0].x === 'number' && typeof partners[1].x === 'number') {
                         unionNode.x = (partners[0].x + partners[1].x) / 2;
                     }
                } else if (partners.length === 1 && typeof partners[0].x === 'number') {
                    // Single parent: offset leggero
                    unionNode.x = partners[0].x + (this.X_SPACING * 0.3);
                }
            });
        }

        // Crea gli edge con informazioni dettagliate
        unions.forEach(union => {
            // Person -> Union (linee dei partner)
            union.partnerIds.forEach(partnerId => {
                edges.push({
                    id: `partner-${partnerId}-${union._id}`,
                    from: partnerId,
                    to: union._id,
                    type: 'partner',
                    style: 'solid' // Linea solida per partner
                });
            });

            // Union -> Child (linee verso i figli)
            union.childrenIds.forEach(childId => {
                // Trova il tipo di parentela per questo figlio
                const childNode = finalNodes.find(n => n._id === childId);
                let parentalType = 'bio'; // default
                
                if (childNode && childNode.parentRefs) {
                    // Verifica se ENTRAMBI i partner sono genitori biologici
                    const parentTypes = union.partnerIds.map(partnerId => {
                        const ref = childNode.parentRefs.find(
                            r => r.parentId.toString() === partnerId.toString()
                        );
                        return ref ? ref.type : null;
                    });
                    
                    // Se ha entrambi i genitori biologici -> bio
                    // Se ha un genitore bio e uno no -> mixed (step/adoptive)
                    // Se nessuno è bio -> adoptive/foster
                    const hasBothBio = parentTypes.every(t => t === 'bio');
                    const hasOneBio = parentTypes.some(t => t === 'bio');
                    const hasStep = parentTypes.some(t => t === 'step');
                    const hasAdoptive = parentTypes.some(t => t === 'adoptive');
                    
                    if (hasBothBio) {
                        parentalType = 'bio';
                    } else if (hasStep || (hasOneBio && !hasBothBio)) {
                        parentalType = 'step';
                    } else if (hasAdoptive) {
                        parentalType = 'adoptive';
                    }
                }
                
                edges.push({
                    id: `child-${union._id}-${childId}`,
                    from: union._id,
                    to: childId,
                    type: 'child',
                    parentalType, // 'bio', 'step', 'adoptive', 'foster'
                    style: parentalType === 'bio' ? 'solid' : 'dashed'
                });
            });
        });

        return { nodes: finalNodes, edges };
    }

    /**
     * HELPER: Costruisce coppie per l'ordinamento
     */
    static _buildCouples(persons, unions) {
        const couples = []; // [person1, union, person2] | [person, union] | [person]
        const used = new Set();

        // Prima: coppie complete
        for (const union of unions) {
            if (union.partnerIds.length === 2) {
                const p1 = persons.find(p => p._id === union.partnerIds[0]);
                const p2 = persons.find(p => p._id === union.partnerIds[1]);
                
                if (p1 && p2) {
                    couples.push([p1, union, p2]);
                    used.add(p1._id);
                    used.add(p2._id);
                    used.add(union._id);
                }
            }
        }

        // Poi: single parent unions
        for (const union of unions) {
            if (used.has(union._id)) continue;
            
            const partner = persons.find(p => 
                union.partnerIds.includes(p._id)
            );
            
            // FIX: Assicuriamoci che il partner non sia già stato incluso in un'altra coppia
            // (es. Pompea può essere nella Union principale E in una virtual union)
            // Se è già usato, non possiamo semplicemente ri-aggiungerlo alla lista "couples"
            // perché creerebbe duplicati nel layout.
            // TODO: In futuro gestire multi-partner meglio. Per ora "vince" la prima union (quella completa).
            if (partner && !used.has(partner._id)) {
                couples.push([partner, union]);
                used.add(partner._id);
                used.add(union._id);
            } else if (partner) {
                // Il partner è già mostrato altrove. La union rimane "orfana" nel layout?
                // Se non la mettiamo in couples, non avrà X/Y.
                // Proviamo a tracciare che questa union deve essere posizionata vicino al partner esistente
                // Ma per ora lasciamo così per evitare crash/duplicati visivi. 
                // Il vero fix è assicurarsi che i figli siano nella Union principale.
            }
        }

        // Infine: persone singole
        for (const person of persons) {
            if (!used.has(person._id)) {
                couples.push([person]);
                used.add(person._id);
            }
        }

        return couples;
    }

    /**
     * HELPER: Ordina gli elementi cercando di mantenere vicini i fratelli e le famiglie (Ancestry Sort)
     */
    static _orderItemsByFamily(couples, finalNodes) {
        // Mappa per accesso veloce ai nodi già posizionati
        const nodesMap = new Map(finalNodes.map(n => [n._id.toString(), n]));

        // Calcola uno "score" di posizione per ogni coppia
        const couplesWithScore = couples.map(couple => {
            let totalParentX = 0;
            let parentCount = 0;
            let minBirthDate = Infinity;

            const persons = couple.filter(i => i.kind === 'person');
            
            persons.forEach(person => {
                // Troviamo la data di nascita per fallback
                if (person.birthDate) {
                    const date = new Date(person.birthDate).getTime();
                    if (date < minBirthDate) minBirthDate = date;
                }

                // Cerchiamo i genitori nel grafo già posizionato
                const parentIds = GraphService._getParentIds(person);
                parentIds.forEach(pid => {
                    const parentNode = nodesMap.get(pid.toString());
                    if (parentNode && typeof parentNode.x === 'number') {
                        totalParentX += parentNode.x;
                        parentCount++;
                    }
                });
            });

            // Se nessun genitore trovato, ancestryX è null
            // Se minBirthDate è ancora Infinity, mettiamo 0
            return {
                couple,
                ancestryX: parentCount > 0 ? totalParentX / parentCount : null,
                birthDate: minBirthDate === Infinity ? 0 : minBirthDate
            };
        });

        // Ordina
        couplesWithScore.sort((a, b) => {
            // Caso 1: Entrambi hanno genitori posizionati (sono "figli" del grafo)
            if (a.ancestryX !== null && b.ancestryX !== null) {
                // Se i genitori sono molto vicini (es. fratelli), usa data di nascita
                if (Math.abs(a.ancestryX - b.ancestryX) < 10) {
                    return a.birthDate - b.birthDate;
                }
                // Altrimenti rispetta l'ordine dei genitori
                return a.ancestryX - b.ancestryX;
            }

            // Caso 2: Uno è figlio, l'altro è un "fondatore" (senza genitori nel grafo)
            // Mettiamo i figli a sinistra (o prima) e i fondatori nuovi a destra?
            // Oppure cerchiamo di intercalare?
            // Strategia semplice: I figli hanno priorità posizionale.
            if (a.ancestryX !== null) return -1;
            if (b.ancestryX !== null) return 1;
            
            // Caso 3: Entrambi sono fondatori nuove linee -> ordina per data
            return a.birthDate - b.birthDate;
        });

        // Estrai solo le coppie appiattite
        const ordered = [];
        for (const item of couplesWithScore) {
            ordered.push(...item.couple);
        }

        return ordered;
    }

    /**
     * HELPER: Ordina gli elementi seguendo le coppie (LEGACY / FALLBACK)
     */
    static _orderItemsByCouples(couples) {
        const ordered = [];
        
        // Ordina le coppie per data di nascita del primo elemento
        couples.sort((a, b) => {
            const dateA = a[0].birthDate ? new Date(a[0].birthDate).getTime() : 0;
            const dateB = b[0].birthDate ? new Date(b[0].birthDate).getTime() : 0;
            return dateA - dateB;
        });

        // Appiattisci
        for (const couple of couples) {
            ordered.push(...couple);
        }

        return ordered;
    }

    /**
     * HELPER: Estrae gli ID dei genitori (con fallback legacy)
     */
    static _getParentIds(person) {
        const ids = new Set();

        // Nuovo schema
        if (person.parentRefs && person.parentRefs.length > 0) {
            person.parentRefs.forEach(ref => {
                ids.add(ref.parentId.toString());
            });
        }

        // Legacy fallback
        if (person.parents && person.parents.length > 0) {
            person.parents.forEach(parentId => {
                ids.add(parentId.toString());
            });
        }

        return Array.from(ids);
    }

    /**
     * HELPER: Estrae gli ID dei figli (legacy)
     */
    static _getChildrenIds(person) {
        const ids = new Set();

        if (person.children && person.children.length > 0) {
            person.children.forEach(childId => {
                ids.add(childId.toString());
            });
        }

        return Array.from(ids);
    }

    /**
     * Ripara le union duplicate (utilità di manutenzione)
     */
    static async repairDuplicateUnions(userId) {
        const allUnions = await Union.find({ userId });
        const unionsByKey = new Map(); // "id1-id2" -> unions[]
        
        let merged = 0;
        let deleted = 0;

        // Raggruppa per coppia di partner
        for (const union of allUnions) {
            const key = union.partnerIds
                .map(id => id.toString())
                .sort()
                .join('-');
            
            if (!unionsByKey.has(key)) {
                unionsByKey.set(key, []);
            }
            unionsByKey.get(key).push(union);
        }

        // Unisci i duplicati
        for (const [key, duplicates] of unionsByKey) {
            if (duplicates.length <= 1) continue;

            // Mantieni la prima, unisci le altre
            const [master, ...others] = duplicates;
            const allChildren = new Set(
                master.childrenIds.map(id => id.toString())
            );

            for (const dup of others) {
                // Aggiungi figli
                dup.childrenIds.forEach(childId => {
                    allChildren.add(childId.toString());
                });

                // Aggiorna riferimenti nelle persone
                await Person.updateMany(
                    { unionIds: dup._id },
                    { 
                        $pull: { unionIds: dup._id },
                        $addToSet: { unionIds: master._id }
                    }
                );

                // Elimina duplicato
                await Union.deleteOne({ _id: dup._id });
                deleted++;
            }

            // Aggiorna master con tutti i figli
            master.childrenIds = Array.from(allChildren);
            await master.save();
            merged++;
        }

        return { merged, deleted };
    }
}

module.exports = GraphService;

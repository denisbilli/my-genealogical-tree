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
     * @param {string} focusId - ID della persona focus
     * @param {string} userId - ID dell'utente
     * @param {Object} collapseConfig - Configurazione collassamento { hideDescendants: [], hideAncestors: [] }
     * @returns {Object} { nodes, unions }
     */
    static async getGraph(focusId, userId, collapseConfig = { hideDescendants: [], hideAncestors: [] }) {
        const nodesMap = new Map();  // personId -> personData
        const unionsMap = new Map(); // unionId -> unionData
        const visited = new Set();   // IDs già visitati
        const hiddenDescendantsOf = new Set(collapseConfig.hideDescendants || []);
        const hiddenAncestorsOf = new Set(collapseConfig.hideAncestors || []);

        // BFS: { personId, generation }
        const queue = [{ personId: focusId.toString(), generation: 0 }];

        while (queue.length > 0) {
            const { personId, generation } = queue.shift();
            
            if (visited.has(personId)) continue;
            visited.add(personId);

            // Carica la persona
            const person = await Person.findOne({ _id: personId, userId });
            if (!person) continue;

            // Aggiungi al grafo
            nodesMap.set(personId, {
                ...person.toObject(),
                _id: personId,
                generation,
                kind: 'person',
                // Flag per frontend per sapere se è collassato
                isCollapsedDescendants: hiddenDescendantsOf.has(personId),
                isCollapsedAncestors: hiddenAncestorsOf.has(personId)
            });

            // ========== ANTENATI (genitori) ==========
            // Se questo nodo non ha gli antenati nascosti
            if (!hiddenAncestorsOf.has(personId)) {
                const parentIds = this._getParentIds(person);
                for (const parentId of parentIds) {
                    if (!visited.has(parentId)) {
                        queue.push({ 
                            personId: parentId, 
                            generation: generation - 1 
                        });
                    }
                }
            }

            // ========== DISCENDENTI E PARTNER ==========
            // Trova tutte le unions dove questa persona è partner
            const personUnions = await Union.find({
                userId,
                partnerIds: personId
            });

            for (const union of personUnions) {
                const unionId = union._id.toString();
                
                // Evita duplicati di Union già processate
                if (unionsMap.has(unionId)) continue;

                // Aggiungi union al grafo
                unionsMap.set(unionId, {
                    _id: unionId,
                    partnerIds: union.partnerIds.map(id => id.toString()),
                    childrenIds: union.childrenIds.map(id => id.toString()),
                    type: union.type,
                    generation,
                    kind: 'union'
                });

                // Aggiungi il partner (stessa generazione)
                const partnerId = union.partnerIds
                    .map(id => id.toString())
                    .find(id => id !== personId);
                
                if (partnerId && !visited.has(partnerId)) {
                    queue.push({ 
                        personId: partnerId, 
                        generation: generation // Partner stays in same generation
                    });
                }

                // Aggiungi i figli (generazione successiva)
                // SOLO SE NON SONO NASCOSTI per questo nodo (personId)
                if (!hiddenDescendantsOf.has(personId)) {
                    for (const childId of union.childrenIds) {
                        const childIdStr = childId.toString();
                        if (!visited.has(childIdStr)) {
                            queue.push({ 
                                personId: childIdStr, 
                                generation: generation + 1 
                            });
                        }
                    }
                }
            }

            // ========== GESTIONE FIGLI SENZA UNION (legacy/fallback) ==========
            // Se sono nascosti, salta anche questi
            if (!hiddenDescendantsOf.has(personId)) {
                const childrenIds = this._getChildrenIds(person);
                const childrenInUnions = new Set(
                    Array.from(unionsMap.values())
                        .flatMap(u => u.childrenIds)
                );

                for (const childId of childrenIds) {
                    if (!childrenInUnions.has(childId) && !visited.has(childId)) {
                        // Crea virtual union per questo figlio
                        const virtualUnionId = `virtual-${personId}-${childId}`;
                        
                        if (!unionsMap.has(virtualUnionId)) {
                            unionsMap.set(virtualUnionId, {
                                _id: virtualUnionId,
                                partnerIds: [personId],
                                childrenIds: [childId],
                                type: 'unknown',
                                generation,
                                kind: 'union',
                                isVirtual: true
                            });
                        }

                        queue.push({ 
                            personId: childId, 
                            generation: generation + 1 
                        });
                    }
                }
            }
        }

        return {
            nodes: Array.from(nodesMap.values()),
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

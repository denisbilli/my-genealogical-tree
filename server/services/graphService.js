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
     * @returns {Object} { nodes, unions }
     */
    static async getGraph(focusId, userId) {
        const nodesMap = new Map();  // personId -> personData
        const unionsMap = new Map(); // unionId -> unionData
        const visited = new Set();   // IDs già visitati

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
                kind: 'person'
            });

            // ========== ANTENATI (genitori) ==========
            const parentIds = this._getParentIds(person);
            for (const parentId of parentIds) {
                if (!visited.has(parentId)) {
                    queue.push({ 
                        personId: parentId, 
                        generation: generation - 1 
                    });
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
                
                // Evita duplicati
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
                        generation 
                    });
                }

                // Aggiungi i figli (generazione successiva)
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

            // ========== GESTIONE FIGLI SENZA UNION (legacy/fallback) ==========
            // Se ci sono figli nel campo children ma non hanno union associate
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
            const ordered = this._orderItemsByCouples(couples);

            // Posiziona gli elementi
            const totalWidth = ordered.length * this.X_SPACING;
            const startX = -totalWidth / 2;

            ordered.forEach((item, index) => {
                item.x = startX + (index * this.X_SPACING);
                item.y = gen * this.Y_SPACING;

                // Centra le unions tra i partner
                if (item.kind === 'union') {
                    // Cerca i partner prima in ordered, poi in tutti i finalNodes
                    const partners = item.partnerIds
                        .map(id => {
                            return ordered.find(p => p._id === id) || 
                                   finalNodes.find(p => p._id === id);
                        })
                        .filter(Boolean);

                    if (partners.length === 2) {
                        item.x = (partners[0].x + partners[1].x) / 2;
                    } else if (partners.length === 1) {
                        // Single parent: offset leggero
                        item.x = partners[0].x + (this.X_SPACING * 0.3);
                    }
                    // Se non troviamo i partner, mantieni x dalla posizione sequenziale
                }

                finalNodes.push(item);
            });
        }

        // Crea gli edge
        unions.forEach(union => {
            // Person -> Union (linee dei partner)
            union.partnerIds.forEach(partnerId => {
                edges.push({
                    id: `partner-${partnerId}-${union._id}`,
                    from: partnerId,
                    to: union._id,
                    type: 'partner'
                });
            });

            // Union -> Child (linee verso i figli)
            union.childrenIds.forEach(childId => {
                edges.push({
                    id: `child-${union._id}-${childId}`,
                    from: union._id,
                    to: childId,
                    type: 'child'
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
            
            if (partner) {
                couples.push([partner, union]);
                used.add(partner._id);
                used.add(union._id);
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
     * HELPER: Ordina gli elementi seguendo le coppie
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

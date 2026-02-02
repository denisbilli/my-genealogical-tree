const Person = require('../models/Person');
const Union = require('../models/Union');

/**
 * Service to handle complex Graph Logic for genealogy
 */
class GraphService {

    // Helper: standard "Person" layout width
    static NODE_WIDTH = 250; 
    static NODE_HEIGHT = 100;
    static X_SPACING = 300;
    static Y_SPACING = 200;

    /**
     * Create a new Union between two persons
     */
    static async createUnion(partnerId1, partnerId2, userId) {
        // 1. Check if exists
        let existing = await Union.findOne({
            partnerIds: { $all: [partnerId1, partnerId2] },
            userId
        });
        if (existing) return existing;

        // 2. Create Union
        const union = new Union({
            partnerIds: [partnerId1, partnerId2],
            userId,
            type: 'relationship' // default
        });
        await union.save();

        // 3. Link back to Persons
        await Person.updateMany(
            { _id: { $in: [partnerId1, partnerId2] } },
            { $addToSet: { unionIds: union._id } }
        );

        return union;
    }

    /**
     * Add a child to a Union (and thus to both parents)
     */
    static async addChildToUnion(unionId, childId) {
        const union = await Union.findById(unionId);
        if (!union) throw new Error("Union not found");

        const child = await Person.findById(childId);
        if (!child) throw new Error("Child not found");

        // 1. Add child to Union
        if (!union.childrenIds.includes(childId)) {
            union.childrenIds.push(childId);
            await union.save();
        }

        // 2. Add Parent Refs to Child (Biological assumption for Union)
        const newRefs = union.partnerIds.map(pid => ({
            parentId: pid,
            type: 'bio'
        }));

        // Avoid adding duplicates
        for (let ref of newRefs) {
            const alreadyExists = child.parentRefs.some(
                r => r.parentId.toString() === ref.parentId.toString()
            );
            if (!alreadyExists) {
                child.parentRefs.push(ref);
            }
        }
        await child.save();
    }

    /**
     * Compute the Subtree Graph centered on a Person
     * @param {string} focusId 
     * @param {number} genUp Ancestor generations
     * @param {number} genDown Descendant generations
     */
    static async getGraph(focusId, userId) {
        const nodes = new Map(); // id -> personDoc
        const unions = new Map(); // id -> unionDoc
        const visitedPersons = new Set();
        
        // Queue for BFS: { id, gen, direction: 'up'|'down' }
        const queue = [{ id: focusId.toString(), gen: 0, dir: 'both' }];

        while(queue.length > 0) {
            const { id, gen, dir } = queue.shift();
            if (visitedPersons.has(id)) continue;
            visitedPersons.add(id);

            // Fetch Person
            const person = await Person.findById(id); //.lean() if possible
            if(!person || person.userId.toString() !== userId.toString()) continue;

            nodes.set(id, { 
                ...person.toObject(), 
                _id: person._id.toString(), 
                generation: gen, 
                kind: 'person' 
            });

            // --- UP (Ancestors) ---
            // Look at parentRefs -> Fetch parents
            if (dir === 'both' || dir === 'up') {
                const parentsToVisit = [];

                // 1. New Schema
                if (person.parentRefs && person.parentRefs.length > 0) {
                     person.parentRefs.forEach(ref => parentsToVisit.push(ref.parentId));
                }
                // 2. Legacy Schema Fallback
                else if (person.parents && person.parents.length > 0) {
                     person.parents.forEach(p => parentsToVisit.push(p));
                }

                for (let pId of parentsToVisit) {
                     queue.push({ id: pId.toString(), gen: gen - 1, dir: 'up' });
                }
            }

            // --- DOWN (Descendants) & PARTNERS ---
            // Look at unionIds -> Fetch Unions -> Fetch Children
            // Process Unions in ALL directions to ensure Partners are found (e.g. Grandmothers).
            {
                let foundUnions = [];
                
                // A) Explicit Unions (ROBUST FETCH: Search by partnerIds to find ALL unions, not just linked ones)
                // This fixes the "Double Dot" bug where a union existed but wasn't in person.unionIds
                const dbUnions = await Union.find({ partnerIds: id });
                foundUnions = dbUnions.map(u => u.toObject());

                // B) Legacy Fallback (Only if absolutely no union found in DB, try to infer)
                // Since we now search DB by partnerIds, this fallback is rarely needed unless data is very old/migrated without unions.
                if (foundUnions.length === 0 && (person.spouse?.length > 0 || person.children?.length > 0)) {
                     // Get all children docs to check their parents
                     const childDocs = person.children && person.children.length > 0 
                        ? await Person.find({ _id: { $in: person.children } })
                        : [];

                     // 1. Group children by partner
                     // Map <PartnerId | 'unknown'> -> [ChildId]
                     const childrenByPartner = new Map();
                     
                     for (let child of childDocs) {
                         const parents = (child.parents || []).map(p => p.toString());
                         const otherParent = parents.find(p => p !== id);
                         const key = otherParent || 'unknown';
                         if (!childrenByPartner.has(key)) childrenByPartner.set(key, []);
                         childrenByPartner.get(key).push(child._id.toString());
                     }

                     // 2. Ensure all spouses have a union entry even if no children
                     const spouseIds = (person.spouse || []).map(s => s.toString());
                     for (let sId of spouseIds) {
                         if (!childrenByPartner.has(sId)) {
                             childrenByPartner.set(sId, []);
                         }
                     }

                     // 3. Create Virtual Unions
                     for (let [partnerKey, kids] of childrenByPartner) {
                         const partnerId = partnerKey === 'unknown' ? null : partnerKey;
                         
                         // Double Check: Did we really miss a union?
                         // (Should be covered by A, but redundant check is safe)
                         
                         // Create virtual
                         const vId = partnerId 
                            ? `v-${[id, partnerId].sort().join('-')}` 
                            : `v-${id}-unknown`;
                         
                         foundUnions.push({
                             _id: vId,
                             partnerIds: partnerId ? [id, partnerId] : [id],
                             childrenIds: kids,
                             kind: 'union',
                             generation: gen,
                             isVirtual: true
                         });
                     }
                }

                
                // Track processed couples to avoid Duplicate Unions (Two dots)
                // Map <"minId-maxId"> -> true
                const processedCouples = new Set();

                // Pre-populate with existing unions in the global map
                for (let existingU of unions.values()) {
                    if (existingU.partnerIds && existingU.partnerIds.length >= 1) {
                        const pIds = existingU.partnerIds.map(String).sort();
                        const key = pIds.length > 1 ? pIds.join('-') : `single-${pIds[0]}`;
                        processedCouples.add(key);
                    }
                }

                for (let u of foundUnions) {
                    if (unions.has(u._id.toString())) continue;

                    // SEMANTIC DEDUPLICATION
                    // Check if we already have a union for this couple
                    let isDuplicate = false;
                    if (u.partnerIds && u.partnerIds.length >= 1) {
                         const pIds = u.partnerIds.map(String).sort();
                         const key = pIds.length > 1 ? pIds.join('-') : `single-${pIds[0]}`;
                         if (processedCouples.has(key)) {
                             isDuplicate = true;
                         } else {
                             processedCouples.add(key);
                         }
                    }

                    if (isDuplicate) continue;

                    unions.set(u._id.toString(), {
                        ...u, 
                         _id: u._id.toString(),
                         generation: gen, 
                         kind: 'union'
                    });

                    // Add Partner to rendering (same generation)
                    const partnerId = u.partnerIds.find(pid => pid.toString() !== id);
                    if(partnerId) {
                        queue.push({ id: partnerId.toString(), gen: gen, dir: dir === 'both' ? 'both' : dir });
                    }

                    // Add Children (next generation)
                    // If dir is 'up' (we are at an ancestor), we WANT to see their children (our aunts/uncles/siblings).
                    // So we allow adding children to the queue, switching direction to 'down'.
                    if (u.childrenIds) {
                        for (let childId of u.childrenIds) {
                             // Optimization: If we came from 'up', these are siblings of the previous node.
                             // We might want to limit depth here? For now, full traversal is better for visibility.
                             queue.push({ id: childId.toString(), gen: gen + 1, dir: 'down' });
                        }
                    }
                }
            }
            
            // Handle 'current' (partners added during traversal)
            // Just ensure we fetch them, done above.
        }

        return { nodes: Array.from(nodes.values()), unions: Array.from(unions.values()) };
    }

    /**
     * Compute Layout (X, Y)
     * Smart grouping by "Family Unit" to avoid crossing lines.
     */
    static computeLayout(nodes, unions) {
        // 1. Group by Generation
        const layers = {};
        
        // Add nodes
        nodes.forEach(n => {
            if (!layers[n.generation]) layers[n.generation] = [];
            layers[n.generation].push(n);
        });

        // Add unions (Union nodes go in same layer as partners)
        unions.forEach(u => {
             if (!layers[u.generation]) layers[u.generation] = [];
             layers[u.generation].push(u);
        });

        const finalNodes = [];
        const edges = [];

        // 2. Sort & Position
        Object.keys(layers).sort((a,b) => a-b).forEach(gen => {
            const items = layers[gen];
            
            // --- NEW SORT STRATEGY: GROUP COUPLES ---
            // 1. Seperate Persons and Unions
            const persons = items.filter(i => i.kind === 'person');
            const layerUnions = items.filter(i => i.kind === 'union');
            
            // 2. Sort Persons by birthDate initially to have a rough order
            persons.sort((a,b) => {
                const dateA = a.birthDate ? new Date(a.birthDate).getTime() : 0;
                const dateB = b.birthDate ? new Date(b.birthDate).getTime() : 0;
                return dateA - dateB;
            });

            // 3. Build Ordered List respecting Couples & Chains (Remarriages)
            const ordered = [];
            const visited = new Set();

            // Helper to recursively add a chain of partners (P1 - U1 - P2 - U2 - P3...)
            const addToChain = (person) => {
                if (visited.has(person._id.toString())) return;
                
                ordered.push(person);
                visited.add(person._id.toString());

                // Find all unions for this person in this layer
                const myUnions = layerUnions.filter(u => u.partnerIds.map(String).includes(person._id.toString()));
                
                myUnions.forEach(u => {
                    if (visited.has(u._id.toString())) return; 

                    // Find the "Other" partner
                    const partnerId = u.partnerIds.find(id => String(id) !== String(person._id));
                    const partner = persons.find(px => String(px._id) === String(partnerId));

                    // CASE A: Standard Couple (P1 - U - P2)
                    if (partner) {
                        if (!visited.has(partner._id.toString())) {
                            // Add Union
                            ordered.push(u);
                            visited.add(u._id.toString());
                            // Recurse on Partner to continue the chain
                            addToChain(partner);
                        } else {
                            // Partner already visited? This means a cycle or we are closing a loop.
                            // Just add the union to connect them visually?
                            // Actually if partner is visited, we might need to inject 'u' between them? 
                            // Complex. For tree, cycles are rare. Assume linear.
                            // If partner is already in 'ordered', maybe we can't place 'u' next to both.
                            // Skip 'u' for placement to avoid jumping, OR append it here.
                            ordered.push(u);
                            visited.add(u._id.toString());
                        }
                    } 
                    // CASE B: Single Parent Union (P1 - U - [Unknown])
                    else {
                        // Just add the union next to P1
                        ordered.push(u);
                        visited.add(u._id.toString());
                    }
                });
            };

            // Iterate sorted persons to Seed chains
            persons.forEach(p => {
                addToChain(p);
            });

            // Add any remaining orphans (unions that might have been missed? Unlikely)
            items.forEach(i => {
                if (!visited.has(i._id.toString())) {
                    ordered.push(i);
                }
            });

            // Clean up: Filter out "Single" unions if the person is also in a "Couple" union?
            // Heuristic Strategy:
            // If the sequence is [P1, U_single, U_couple, P2] -> Remove U_single?
            // Let's rely on the user seeing them and deleting them, layout just places them nicely now.

            // Center alignment
            const totalWidth = ordered.length * this.X_SPACING;
            let startX = -(totalWidth / 2);

            ordered.forEach((item, index) => {
                // Determine Position
                item.x = startX + (index * this.X_SPACING);
                item.y = item.generation * this.Y_SPACING;

                // Adjust for Union: STRICT CENTER
                if (item.kind === 'union') {
                    // Find partners in the `ordered` list (they are strictly close now due to chain logic)
                    const p1 = ordered.find(x => x._id === item.partnerIds[0]?.toString());
                    const p2 = ordered.find(x => x._id === item.partnerIds[1]?.toString());
                    
                    if (p1 && p2) {
                        item.x = (p1.x + p2.x) / 2;
                    } else if (p1) {
                         // Single parent union: Place slightly offset to right of parent
                         item.x = p1.x + (this.X_SPACING / 2);
                    }
                }

                finalNodes.push(item);
            });
        });

        // 3. Edges
        // Person -> Union (Partner)
        unions.forEach(u => {
            u.partnerIds.forEach(pid => {
                const p = nodes.find(n => n._id === pid.toString());
                if (p) {
                    edges.push({ id: `e-${p._id}-${u._id}`, from: p._id, to: u._id, type: 'partner' });
                }
            });

            // Union -> Child
            u.childrenIds.forEach(cid => {
                 const c = nodes.find(n => n._id === cid.toString());
                 if (c) {
                    edges.push({ id: `e-${u._id}-${c._id}`, from: u._id, to: c._id, type: 'child' });
                 }
            });
        });

        return { nodes: finalNodes, edges };
    }
}

module.exports = GraphService;

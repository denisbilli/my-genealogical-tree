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
                if (person.parentRefs) {
                     for (let ref of person.parentRefs) {
                         // Find layout parents
                         queue.push({ id: ref.parentId.toString(), gen: gen - 1, dir: 'up' });
                         
                         // We also need the Union between these parents if it exists, to draw the Edge
                         // Optimization: Unions are usually fetched when we visit the parents
                     }
                }
            }

            // --- DOWN (Descendants) & PARTNERS ---
            // Look at unionIds -> Fetch Unions -> Fetch Children
            if (dir === 'both' || dir === 'down' || dir === 'current') {
                let foundUnions = [];
                
                // A) Explicit Unions
                if (person.unionIds && person.unionIds.length > 0) {
                    const dbUnions = await Union.find({ _id: { $in: person.unionIds } });
                    foundUnions = dbUnions.map(u => u.toObject());
                }

                // B) Legacy Fallback (if no explicit unions found, try to infer from spouse/children)
                // Only infer if we didn't find specific unions, OR if we want to be additive. 
                // Let's be additive but avoid duplicates.
                if (person.spouse?.length > 0 || person.children?.length > 0) {
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
                         
                         // Check if a real union already covers this pair
                         const exists = foundUnions.some(u => 
                            (partnerId && u.partnerIds.map(String).includes(partnerId)) ||
                            (!partnerId && u.partnerIds.length === 1 && String(u.partnerIds[0]) === id)
                         );

                         if (!exists) {
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
                }

                
                for (let u of foundUnions) {
                    if (unions.has(u._id.toString())) continue;

                    unions.set(u._id.toString(), {
                        ...u, 
                         _id: u._id.toString(),
                         generation: gen, 
                         kind: 'union'
                    });

                    // Add Partner to rendering (same generation)
                    const partnerId = u.partnerIds.find(pid => pid.toString() !== id);
                    if(partnerId) {
                        queue.push({ id: partnerId.toString(), gen: gen, dir: 'current' });
                    }

                    // Add Children (next generation)
                    if (u.childrenIds) {
                        for (let childId of u.childrenIds) {
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
     * Simplified approach: Groups by Generation, centers them.
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
             // Heuristic: Union generation is avg of partners or inherited
             // Just stick it in the layer defined during traversal
             if (!layers[u.generation]) layers[u.generation] = [];
             layers[u.generation].push(u);
        });

        const finalNodes = [];
        const edges = [];

        // 2. Sort & Position
        Object.keys(layers).sort((a,b) => a-b).forEach(gen => {
            const items = layers[gen];
            
            // Sort Strategy: 
            // - Partners should be near each other.
            // - Union should be between partners.
            // - Siblings should be near each other.
            // This is complex. For now, simple ID sort or preservation.
            items.sort((a,b) => (a.kind === 'union' ? 1 : -1)); // push unions to end? No, mixing needed.

            // Center alignment
            const totalWidth = items.length * this.X_SPACING;
            let startX = -(totalWidth / 2);

            items.forEach((item, index) => {
                // Determine Position
                item.x = startX + (index * this.X_SPACING);
                item.y = item.generation * this.Y_SPACING;

                // Adjust for Union:
                // If Item is Union, place it EXACTLY between its partners (if they are in this layer)
                if (item.kind === 'union') {
                    const p1 = items.find(x => x._id === item.partnerIds[0]?.toString());
                    const p2 = items.find(x => x._id === item.partnerIds[1]?.toString());
                    if (p1 && p2) {
                        item.x = (p1.x + p2.x) / 2;
                        // Also push spouse p2 to be right next to p1? 
                        // Simplified: Let's assume standard X spacing handles enough room.
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

const mongoose = require('mongoose');
const Person = require('../server/models/Person');
const Union = require('../server/models/Union');
const GraphService = require('../server/services/graphService');

// Hardcode URI since .env is missing or loaded via Docker
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/genealogical-tree';

const runDebug = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find Denis Billi
        const denis = await Person.findOne({ firstName: 'Denis', lastName: 'Billi' });
        if (!denis) {
            console.log('Denis not found');
            return;
        }

        console.log('Generating graph for:', denis.firstName);
        const { nodes, unions } = await GraphService.getGraph(denis._id, denis.userId);
        
        const layout = GraphService.computeLayout(nodes, unions);

        console.log('--- LAYOUT NODES ---');
        layout.nodes.forEach(n => {
            console.log(`[${n.kind.toUpperCase()}] ${n.firstName || 'Union'} (${n.x}, ${n.y}) ID:${n._id}`);
            if (n.kind === 'union') {
                console.log(`   Partners: ${n.partnerIds}`);
                console.log(`   Children: ${n.childrenIds}`);
            }
        });

        console.log('--- LAYOUT EDGES ---');
        layout.edges.forEach(e => {
            console.log(`[${e.type}] ${e.from} -> ${e.to} (style: ${e.style})`);
        });

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runDebug();
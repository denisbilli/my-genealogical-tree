const mongoose = require('mongoose');
const User = require('../server/models/User');
const Person = require('../server/models/Person');
const GraphService = require('../server/services/graphService');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/genealogical-tree';

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const person = await Person.findOne();
    if (!person) {
        console.log('No people in DB.');
        process.exit(0);
    }
    console.log('Found person:', person.firstName);

    // Test Graph logic
    const { nodes, unions } = await GraphService.getGraph(person._id, person.userId);
    const layout = GraphService.computeLayout(nodes, unions);
    
    console.log('Nodes:', layout.nodes.length);
    console.log('Edges:', layout.edges.length);
    console.log('Sample Node JSON:', JSON.stringify(layout.nodes[0], null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();

#!/bin/bash

# Test dell'API tree endpoint
# Trova personId
PERSON_ID=$(docker-compose exec -T app node -e 'const mongoose=require("mongoose");const Person=require("./server/models/Person");mongoose.connect("mongodb://mongo:27017/genealogical-tree").then(async()=>{const p=await Person.findOne({parents:{$size:0}});console.log(p._id.toString());process.exit(0);});' 2>&1 | tail -1)

echo "Testing API con personId: $PERSON_ID"
echo "======================================"

# Prova a chiamare l'endpoint (senza auth per ora, solo per vedere cosa restituisce)
docker-compose exec app node -e "
const mongoose = require('mongoose');
const Person = require('./server/models/Person');
const GraphService = require('./server/services/graphService');

mongoose.connect('mongodb://mongo:27017/genealogical-tree').then(async () => {
  const person = await Person.findOne({parents: {\$size: 0}});
  const { nodes, unions } = await GraphService.getGraph(person._id, person.userId);
  const layout = GraphService.computeLayout(nodes, unions);
  
  console.log(JSON.stringify({
    nodes: layout.nodes.length,
    edges: layout.edges.length,
    sample_nodes: layout.nodes.slice(0, 3).map(n => ({
      kind: n.kind,
      name: n.firstName || 'Union',
      generation: n.generation,
      x: n.x,
      y: n.y
    }))
  }, null, 2));
  
  process.exit(0);
});
"

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Person = require('../models/Person');
const Union = require('../models/Union');
const GraphService = require('../services/graphService');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Get all persons for authenticated user
router.get('/', auth, apiLimiter, async (req, res) => {
  try {
    const persons = await Person.find({ userId: req.userId })
      .populate('parents', 'firstName lastName')
      .populate('children', 'firstName lastName')
      .populate('spouse', 'firstName lastName');
    res.json(persons);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single person
router.get('/:id', auth, apiLimiter, async (req, res) => {
  try {
    const person = await Person.findOne({ _id: req.params.id, userId: req.userId })
      .populate('parents')
      .populate('children')
      .populate('spouse');
    
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }
    
    res.json(person);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new person
router.post('/', auth, uploadLimiter, upload.single('photo'), async (req, res) => {
  try {
    const personData = {
      ...req.body,
      userId: req.userId
    };

    if (req.file) {
      personData.photoUrl = `/uploads/${req.file.filename}`;
    }

    // Parse spouse field
    if (req.body.spouse) {
        try {
            personData.spouse = JSON.parse(req.body.spouse);
        } catch (e) {
            // Keep as is if not json list
        }
    }

    const person = new Person(personData);
    await person.save();

    // ========== GESTIONE SPOUSE: Crea Union ==========
    if (personData.spouse && Array.isArray(personData.spouse)) {
         // Aggiorna legacy field sugli spouse
         await Person.updateMany(
            { _id: { $in: personData.spouse }, userId: req.userId },
            { $addToSet: { spouse: person._id } }
         );
         
         // Crea Union per ogni spouse
         for (const spouseId of personData.spouse) {
             await GraphService.createUnion(person._id, spouseId, req.userId);
         }
    }

    // ========== GESTIONE PARENT: Usa parentRefs ==========
    if (req.body.parentIds) {
      const parentIds = JSON.parse(req.body.parentIds);
      
      // Nuovo schema: parentRefs
      person.parentRefs = parentIds.map(pid => ({
        parentId: pid,
        type: 'bio'
      }));
      
      // Legacy: parents array
      person.parents = parentIds;
      await person.save();
      
      // Add child to parents (legacy)
      await Person.updateMany(
        { _id: { $in: parentIds }, userId: req.userId },
        { $addToSet: { children: person._id } }
      );

      // ========== UNION SYNC: Aggiungi figlio alle Union dei genitori ==========
      // Se i genitori fanno parte di una Union, aggiungi automaticamente il figlio
      try {
          const parents = await Person.find({ _id: { $in: parentIds } });
          for (const parent of parents) {
              const unions = await GraphService.findUnionsForPerson(parent._id, req.userId);
              
              // Se c'è una sola union, assumiamo che il figlio appartenga a quella famiglia (nucleo corrente)
              const singleUnionCase = unions.length === 1 && parentIds.length === 1;

              for (const union of unions) {
                  const isOtherPartnerParent = parentIds.includes(
                      union.partnerIds.find(pid => pid.toString() !== parent._id.toString())?.toString()
                  );
                  
                  // Se entrambi i partner sono genitori -> aggiungi alla union
                  // Oppure se è una union single-parent
                  // O se stiamo aggiungendo a un genitore che ha una sola unione attiva
                  if (isOtherPartnerParent || union.partnerIds.length === 1 || singleUnionCase) {
                      await GraphService.addChildToUnion(union._id, person._id, 'bio');
                  } else {
                      // È uno step-child per questa union?
                      // Se il figlio ha il genitore A, ma non B, e A e B sono in union
                      // Allora per questa union è "step" (se vogliamo aggiungerlo auto)
                      // Per ora aggiungiamo AUTOMATICAMENTE solo se è figlio di ENTRAMBI i partner
                      // (comportamento "famiglia nucleare" default)
                  }
              }
          }
      } catch (err) {
          console.error("Auto-add child to union failed:", err);
      }
    }

    const populatedPerson = await Person.findById(person._id)
      .populate('parents')
      .populate('children')
      .populate('spouse');

    res.status(201).json(populatedPerson);
  } catch (error) {
    console.error('Create Person Error:', error);
    res.status(500).json({ message: 'Errore server', error: error.message });
  }
});

// Update person
router.put('/:id', auth, uploadLimiter, upload.single('photo'), async (req, res) => {
  try {
    const person = await Person.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!person) {
      return res.status(404).json({ message: 'Persona non trovata' });
    }

    const updateData = { ...req.body };
    
    if (req.file) {
      updateData.photoUrl = `/uploads/${req.file.filename}`;
    }

    // Parse complex fields from FormData (strings)
    if (updateData.parents) {
       try {
         updateData.parents = JSON.parse(updateData.parents);
       } catch (e) { console.error("Error parsing parents", e); }
    }
    if (updateData.children) {
       try {
         updateData.children = JSON.parse(updateData.children);
       } catch (e) { console.error("Error parsing children", e); }
    }
    if (updateData.spouse) {
       try {
         updateData.spouse = JSON.parse(updateData.spouse);
       } catch (e) { console.error("Error parsing spouse", e); }
    }

    Object.assign(person, updateData);
    await person.save();

    // ========== AGGIORNA PARENTREFS ==========
    if (updateData.parents && Array.isArray(updateData.parents)) {
         // Sincronizza parentRefs con parents array
         const existingParentIds = person.parentRefs.map(ref => ref.parentId.toString());
         
         for (const parentId of updateData.parents) {
             if (!existingParentIds.includes(parentId.toString())) {
                 person.parentRefs.push({
                     parentId,
                     type: 'bio'
                 });
             }
         }
         
         await person.save();
         
         // Update reciprocal: add THIS person as child to parents
         await Person.updateMany(
            { _id: { $in: updateData.parents }, userId: req.userId },
            { $addToSet: { children: person._id } }
         );

         // === AUTO-LINK PARENTS ===
         // Se la persona ha ora 2 genitori, crea automaticamente una Union tra loro
         // e aggiungi questa persona come figlio della Union.
         // Filtra solo i genitori 'bio' o quelli appena aggiunti
         const currentParents = person.parentRefs.filter(ref => ref.type === 'bio' || !ref.type);
         
         if (currentParents.length === 2) {
             const [p1, p2] = currentParents;
             try {
                 const union = await GraphService.createUnion(p1.parentId, p2.parentId, req.userId);
                 await GraphService.addChildToUnion(union._id, person._id);
                 console.log(`Auto-linked parents ${p1.parentId} & ${p2.parentId} for child ${person._id}`);
             } catch (err) {
                 console.error("Auto-link parents failed", err);
             }
         }
    }
    
    // ========== AGGIORNA CHILDREN ==========
    if (updateData.children && Array.isArray(updateData.children)) {
         // Add THIS person as parent to children
         for (const childId of updateData.children) {
             const child = await Person.findById(childId);
             if (child) {
                 const alreadyExists = child.parentRefs.some(
                     ref => ref.parentId.toString() === person._id.toString()
                 );
                 if (!alreadyExists) {
                     child.parentRefs.push({
                         parentId: person._id,
                         type: 'bio'
                     });
                     if (!child.parents.includes(person._id)) {
                         child.parents.push(person._id);
                     }
                     await child.save();
                 }
             }
         }
    }
    
    // ========== AGGIORNA SPOUSE: Crea/Aggiorna Union ==========
    if (updateData.spouse && Array.isArray(updateData.spouse)) {
         // Crea Union per ogni spouse se non esiste
         for (const spouseId of updateData.spouse) {
             await GraphService.createUnion(person._id, spouseId, req.userId);
         }
         
         // Update reciprocal legacy field
         await Person.updateMany(
            { _id: { $in: updateData.spouse }, userId: req.userId },
            { $addToSet: { spouse: person._id } }
         );
    }

    const populatedPerson = await Person.findById(person._id)
      .populate('parents')
      .populate('children')
      .populate('spouse');

    res.json(populatedPerson);
  } catch (error) {
    console.error('Update Person Error:', error);
    res.status(500).json({ message: 'Errore server', error: error.message });
  }
});

// Delete person
router.delete('/:id', auth, apiLimiter, async (req, res) => {
  try {
    const person = await Person.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    // Remove from parent's children
    await Person.updateMany(
      { children: person._id },
      { $pull: { children: person._id } }
    );

    // Remove from children's parents (Legacy)
    await Person.updateMany(
      { parents: person._id },
      { $pull: { parents: person._id } }
    );
    
    // Remove from children's parentRefs (New Schema)
    await Person.updateMany(
        { "parentRefs.parentId": person._id },
        { $pull: { parentRefs: { parentId: person._id } } }
    );

    // Remove from spouse (Legacy)
    await Person.updateMany(
      { spouse: person._id },
      { $pull: { spouse: person._id } }
    );

    // Cleanup Unions (Critical for Graph Stability)
    // 1. Find unions where this person is a partner
    const unions = await Union.find({ partnerIds: person._id });
    const unionIds = unions.map(u => u._id);
    
    if (unionIds.length > 0) {
        // 2. Remove these unions from the 'unionIds' of any surviving partners
        await Person.updateMany(
            { unionIds: { $in: unionIds } },
            { $pull: { unionIds: { $in: unionIds } } }
        );
        
        // 3. Delete the unions themselves to prevent ghost relationships
        await Union.deleteMany({ _id: { $in: unionIds } });
    }

    await person.deleteOne();
    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset Database (Delete all persons and unions for this user)
router.post('/reset', auth, async (req, res) => {
    try {
        await Person.deleteMany({ userId: req.userId });
        await Union.deleteMany({ userId: req.userId });
        res.json({ message: 'Database reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Add relationship (parent, child, spouse)
router.post('/:id/relationship', auth, apiLimiter, async (req, res) => {
  try {
    const { relatedPersonId, relationshipType } = req.body;
    
    const person = await Person.findOne({ _id: req.params.id, userId: req.userId });
    const relatedPerson = await Person.findOne({ _id: relatedPersonId, userId: req.userId });
    
    if (!person || !relatedPerson) {
      return res.status(404).json({ message: 'Persona non trovata' });
    }

    if (relationshipType === 'parent') {
      // Aggiungi parent usando parentRefs (nuovo schema)
      const alreadyExists = person.parentRefs.some(
        ref => ref.parentId.toString() === relatedPersonId.toString()
      );
      if (!alreadyExists) {
        person.parentRefs.push({
          parentId: relatedPersonId,
          type: 'bio'
        });
      }
      
      // Legacy fallback
      if (!person.parents.includes(relatedPersonId)) {
        person.parents.push(relatedPersonId);
      }
      if (!relatedPerson.children.includes(person._id)) {
        relatedPerson.children.push(person._id);
      }
      
    } else if (relationshipType === 'child') {
      // Aggiungi child usando parentRefs sul figlio
      const alreadyExists = relatedPerson.parentRefs.some(
        ref => ref.parentId.toString() === person._id.toString()
      );
      if (!alreadyExists) {
        relatedPerson.parentRefs.push({
          parentId: person._id,
          type: 'bio'
        });
      }
      
      // Legacy fallback
      if (!person.children.includes(relatedPersonId)) {
        person.children.push(relatedPersonId);
      }
      if (!relatedPerson.parents.includes(person._id)) {
        relatedPerson.parents.push(person._id);
      }
      
    } else if (relationshipType === 'spouse') {
      // Crea o ottieni Union tra i due partner
      const union = await GraphService.createUnion(person._id, relatedPersonId, req.userId);
      
      // Legacy fallback
      if (!person.spouse.includes(relatedPersonId)) {
        person.spouse.push(relatedPersonId);
      }
      if (!relatedPerson.spouse.includes(person._id)) {
        relatedPerson.spouse.push(person._id);
      }
    }

    await person.save();
    await relatedPerson.save();

    res.json({ message: 'Relazione aggiunta con successo' });
  } catch (error) {
    console.error('Add Relationship Error:', error);
    res.status(500).json({ message: 'Errore server', error: error.message });
  }
});

// Search for potential matches across all users
router.get('/search/matches', auth, apiLimiter, async (req, res) => {
  try {
    const userPersons = await Person.find({ userId: req.userId });
    const matches = [];

    for (const person of userPersons) {
      // Search for persons with same name and similar birth dates in other users' trees
      const query = {
        userId: { $ne: req.userId },
        firstName: person.firstName,
        lastName: person.lastName
      };

      // Only add birth date comparison if the person has a birth date
      if (person.birthDate) {
        query.$or = [
          { birthDate: person.birthDate },
          {
            birthDate: {
              $gte: new Date(person.birthDate.getFullYear() - 2, 0, 1),
              $lte: new Date(person.birthDate.getFullYear() + 2, 11, 31)
            }
          }
        ];
      }

      const potentialMatches = await Person.find(query).populate('userId', 'username fullName');

      if (potentialMatches.length > 0) {
        matches.push({
          person,
          matches: potentialMatches
        });
      }
    }

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Person = require('../models/Person');
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

    if (req.body.spouse) {
        try {
            personData.spouse = JSON.parse(req.body.spouse);
        } catch (e) {
            // Keep as is if not json list
        }
    }

    const person = new Person(personData);
    await person.save();

    // Update relationships if provided
    if (personData.spouse && Array.isArray(personData.spouse)) {
         await Person.updateMany(
            { _id: { $in: personData.spouse }, userId: req.userId },
            { $addToSet: { spouse: person._id } }
         );
    }

    if (req.body.parentIds) {
      const parentIds = JSON.parse(req.body.parentIds);
      person.parents = parentIds;
      await person.save();
      
      // Add child to parents
      await Person.updateMany(
        { _id: { $in: parentIds }, userId: req.userId },
        { $addToSet: { children: person._id } }
      );
    }

    const populatedPerson = await Person.findById(person._id)
      .populate('parents')
      .populate('children')
      .populate('spouse');

    res.status(201).json(populatedPerson);
  } catch (error) {
    console.error('Create Person Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update person
router.put('/:id', auth, uploadLimiter, upload.single('photo'), async (req, res) => {
  try {
    const person = await Person.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
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

    // Reciprocal relationships update (Optional for robustness)
    // If we added parents to THIS person, we should ensure those parents have THIS person as child
    if (updateData.parents && Array.isArray(updateData.parents)) {
         await Person.updateMany(
            { _id: { $in: updateData.parents }, userId: req.userId },
            { $addToSet: { children: person._id } }
         );
    }
    // If we added children to THIS person, ensure those children have THIS person as parent
    if (updateData.children && Array.isArray(updateData.children)) {
         await Person.updateMany(
            { _id: { $in: updateData.children }, userId: req.userId },
            { $addToSet: { parents: person._id } }
         );
    }
    // If we added spouse to THIS person, ensure spouse has THIS person in spouse
    if (updateData.spouse && Array.isArray(updateData.spouse)) {
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
    res.status(500).json({ message: 'Server error', error: error.message });
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

    // Remove from children's parents
    await Person.updateMany(
      { parents: person._id },
      { $pull: { parents: person._id } }
    );

    // Remove from spouse
    await Person.updateMany(
      { spouse: person._id },
      { $pull: { spouse: person._id } }
    );

    await person.deleteOne();
    res.json({ message: 'Person deleted successfully' });
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
      return res.status(404).json({ message: 'Person not found' });
    }

    if (relationshipType === 'parent') {
      person.parents.addToSet(relatedPersonId);
      relatedPerson.children.addToSet(person._id);
    } else if (relationshipType === 'child') {
      person.children.addToSet(relatedPersonId);
      relatedPerson.parents.addToSet(person._id);
    } else if (relationshipType === 'spouse') {
      person.spouse.addToSet(relatedPersonId);
      relatedPerson.spouse.addToSet(person._id);
    }

    await person.save();
    await relatedPerson.save();

    res.json({ message: 'Relationship added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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

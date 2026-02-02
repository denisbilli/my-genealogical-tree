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

    const person = new Person(personData);
    await person.save();

    // Update relationships if provided
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

    Object.assign(person, updateData);
    await person.save();

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

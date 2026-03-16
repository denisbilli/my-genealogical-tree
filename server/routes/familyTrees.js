const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FamilyTree = require('../models/FamilyTree');
const Person = require('../models/Person');
const Union = require('../models/Union');

// GET /api/family-trees — list all trees for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const trees = await FamilyTree.find({ userId: req.userId }).sort({ createdAt: 1 });
    // Attach person count to each tree
    const treesWithCount = await Promise.all(
      trees.map(async (tree) => {
        const count = await Person.countDocuments({ userId: req.userId, treeId: tree._id });
        return { ...tree.toObject(), personCount: count };
      })
    );
    res.json(treesWithCount);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/family-trees — create a new family tree
router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tree name is required' });
    }

    // Check for duplicate name within this user's trees
    const existing = await FamilyTree.findOne({ userId: req.userId, name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'A tree with this name already exists' });
    }

    // First tree becomes the default
    const treeCount = await FamilyTree.countDocuments({ userId: req.userId });
    const tree = new FamilyTree({
      userId: req.userId,
      name: name.trim(),
      description: description || '',
      isDefault: treeCount === 0
    });
    await tree.save();
    res.status(201).json(tree);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/family-trees/:id — update a family tree
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, isDefault } = req.body;
    const tree = await FamilyTree.findOne({ _id: req.params.id, userId: req.userId });
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    if (name) {
      const duplicate = await FamilyTree.findOne({
        userId: req.userId,
        name: name.trim(),
        _id: { $ne: tree._id }
      });
      if (duplicate) return res.status(400).json({ message: 'A tree with this name already exists' });
      tree.name = name.trim();
    }
    if (description !== undefined) tree.description = description;

    // When setting this tree as default, unset all others
    if (isDefault === true) {
      await FamilyTree.updateMany({ userId: req.userId, _id: { $ne: tree._id } }, { isDefault: false });
      tree.isDefault = true;
    }

    await tree.save();
    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/family-trees/:id — delete a tree and all its persons/unions
router.delete('/:id', auth, async (req, res) => {
  try {
    const tree = await FamilyTree.findOne({ _id: req.params.id, userId: req.userId });
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Count trees — user must keep at least one tree
    const treeCount = await FamilyTree.countDocuments({ userId: req.userId });
    if (treeCount <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last tree' });
    }

    // Delete all persons in this tree
    const persons = await Person.find({ userId: req.userId, treeId: tree._id });
    const personIds = persons.map((p) => p._id);

    // Delete associated unions
    await Union.deleteMany({ userId: req.userId, partnerIds: { $in: personIds } });
    await Person.deleteMany({ userId: req.userId, treeId: tree._id });
    await FamilyTree.deleteOne({ _id: tree._id });

    // If this was the default tree, promote the oldest remaining tree
    if (tree.isDefault) {
      const oldest = await FamilyTree.findOne({ userId: req.userId }).sort({ createdAt: 1 });
      if (oldest) {
        oldest.isDefault = true;
        await oldest.save();
      }
    }

    res.json({ message: 'Tree deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

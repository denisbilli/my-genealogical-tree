const mongoose = require('mongoose');

const personSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  birthDate: {
    type: Date
  },
  birthPlace: {
    type: String,
    trim: true
  },
  deathDate: {
    type: Date
  },
  deathPlace: {
    type: String,
    trim: true
  },
  photoUrl: {
    type: String
  },
  notes: {
    type: String
  },
  
  // New Schema Structure conforming to "Pedigree Graph" requirements
  
  // Parents: Explicit reference + type
  parentRefs: [{
    _id: false,
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person'
    },
    type: {
      type: String,
      enum: ['bio', 'adoptive', 'step', 'foster'],
      default: 'bio'
    },
    certainty: {
      type: Number,
      default: 1
    }
  }],

  // Denormalized access to Unions (where this person is a partner)
  unionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Union'
  }],

  // Legacy/Compatibility fields (Restored to prevent crashes in legacy routes)
  parents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],
  spouse: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp
personSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Index for faster searches
personSchema.index({ firstName: 1, lastName: 1 });
personSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Person', personSchema);

const mongoose = require('mongoose');

const familyTreeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

familyTreeSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

familyTreeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('FamilyTree', familyTreeSchema);

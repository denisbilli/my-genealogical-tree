const mongoose = require('mongoose');

const unionSchema = new mongoose.Schema({
  // Partner IDs (usually 2, ordered for consistency if needed)
  partnerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],
  
  // Children belonging to this union
  childrenIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],

  // Metadata
  type: {
    type: String, 
    enum: ['marriage', 'civil', 'relationship', 'unknown'],
    default: 'unknown'
  },
  startDate: Date,
  endDate: Date,
  
  spouse: { type: Boolean, default: false }, // Legacy flag helper

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, { timestamps: true });

// Validations
unionSchema.index({ partnerIds: 1 });
unionSchema.index({ childrenIds: 1 });

module.exports = mongoose.model('Union', unionSchema);

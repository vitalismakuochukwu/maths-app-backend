const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  currentLevel: { type: Number, default: 1 },
  stars: { type: Number, default: 0 },
  highScore: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Child', childSchema);
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  gender: { type: String, required: true, enum: ['male', 'female', 'other'] },
  phone: { type: String },
  nationality: { type: String },
  state: { type: String },
  dateOfBirth: { type: Date },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  verificationCodeExpires: Date,
  // Game Progress
  currentLevel: { type: Number, default: 1 },
  stars: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
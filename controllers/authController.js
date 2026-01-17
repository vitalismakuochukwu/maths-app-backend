const User = require('../models/User');
const Child = require('../models/Child');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

exports.register = async (req, res) => {
  try {
    const { fullName, email, gender, password } = req.body;

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Always log the code in the console for testing purposes
    console.log(`[DEV] Verification Code for ${email}: ${verificationCode}`);

    user = new User({
      fullName, email, gender,
      password: hashedPassword,
      verificationCode,
      verificationCodeExpires: Date.now() + 3600000 // 1 hour
    });

    await user.save();

    // Send Email (Log to console if no API key for dev)
    if (resend) {
      try {
        console.log(`[Resend] Attempting to send verification code to ${email}...`);
        const { data, error } = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Verify your TinyMath Account',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <h2 style="color: #2563eb; text-align: center;">Welcome to TinyMath! 🚀</h2>
              <p style="font-size: 16px; color: #374151; text-align: center;">Please verify your email address to activate your parent account.</p>
              <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
                <span style="font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #1f2937;">${verificationCode}</span>
              </div>
              <p style="text-align: center; color: #6b7280; font-size: 14px;">This code will expire in 1 hour.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="text-align: center; color: #9ca3af; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
          `
        });

        if (error) {
          console.error("[Resend] API Error:", error);
          // Return the specific error message to help debugging (e.g. "sandbox restricted")
          return res.status(500).json({ message: `Email sending failed: ${error.message}` });
        }
        console.log("[Resend] Email sent successfully:", data);
      } catch (emailError) {
        console.error("[Resend] Unexpected Error:", emailError);
        return res.status(500).json({ message: "Failed to send verification email." });
      }
    } else {
      console.warn("[Resend] API Key is missing in .env. Skipping email send.");
    }

    res.status(201).json({ message: 'Registration successful. Check email for code.', email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addChild = async (req, res) => {
  try {
    const { parentId, name, age } = req.body;
    
    // Automatically set difficulty based on age
    let initialLevel = 1;
    if (age >= 3 && age <= 4) initialLevel = 2;
    if (age >= 5) initialLevel = 3;

    const child = new Child({ parentId, name, age, currentLevel: initialLevel });
    await child.save();
    res.status(201).json(child);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getChildren = async (req, res) => {
  try {
    const children = await Child.find({ parentId: req.params.parentId });
    res.json(children);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'User already verified' });
    if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.isVerified) return res.status(400).json({ message: 'Please verify your email first' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        gender: user.gender,
        phone: user.phone,
        nationality: user.nationality,
        state: user.state,
        dateOfBirth: user.dateOfBirth,
        currentLevel: user.currentLevel, 
        stars: user.stars 
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'User already verified' });

    // Generate new 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Always log the code in the console for testing purposes
    console.log(`[DEV] New Verification Code for ${email}: ${verificationCode}`);

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    if (resend) {
      try {
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'New Verification Code - TinyMath',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">New Verification Code</h2>
              <p>You requested a new code for your TinyMath account.</p>
              <p style="font-size: 24px; font-weight: bold; color: #1f2937;">${verificationCode}</p>
              <p>This code expires in 1 hour.</p>
            </div>
          `
        });
        if (error) console.error("Resend API Error:", error);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }
    }

    res.json({ message: 'Verification code resent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { id, fullName, gender, phone, nationality, state, dateOfBirth } = req.body;
    
    const user = await User.findByIdAndUpdate(
      id, 
      { fullName, gender, phone, nationality, state, dateOfBirth }, 
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ 
      message: 'Profile updated successfully',
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        gender: user.gender, 
        phone: user.phone,
        nationality: user.nationality,
        state: user.state,
        dateOfBirth: user.dateOfBirth,
        currentLevel: user.currentLevel, 
        stars: user.stars 
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteChild = async (req, res) => {
  try {
    const child = await Child.findByIdAndDelete(req.params.id);
    if (!child) return res.status(404).json({ message: 'Child not found' });
    res.json({ message: 'Child profile deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUser = async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined' || req.params.id === "null") {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      gender: user.gender,
      phone: user.phone,
      nationality: user.nationality,
      state: user.state,
      dateOfBirth: user.dateOfBirth,
      currentLevel: user.currentLevel,
      stars: user.stars
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const { id, stars, currentLevel } = req.body;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { stars, currentLevel } },
      { new: true }
    );
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateChildProgress = async (req, res) => {
  try {
    const { id, stars, currentLevel, highScore } = req.body;
    
    const updateData = { stars, currentLevel };
    if (highScore !== undefined) updateData.highScore = highScore;
    
    const child = await Child.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!child) return res.status(404).json({ message: 'Child not found' });
    res.json(child);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = resetCode;
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Reset Your TinyMath Password',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Password Reset Request</h2>
              <p>Use the code below to reset your password. This code expires in 15 minutes.</p>
              <p style="font-size: 32px; font-weight: bold; color: #1f2937; letter-spacing: 5px;">${resetCode}</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        return res.status(500).json({ message: "Failed to send reset email." });
      }
    }

    res.json({ message: "Reset code sent to your email!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email, verificationCode: code, verificationCodeExpires: { $gt: Date.now() } });

    if (!user) return res.status(400).json({ message: "Invalid or expired code" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
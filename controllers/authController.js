const User = require('../models/User');
const Child = require('../models/Child');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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
      verificationCodeExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    await user.save();

    // Send Email (Log to console if no API key for dev)
  try {
  // Ensure verificationCode is defined before this block!
  await axios.post('https://api.brevo.com/v3/smtp/email', {
 sender: { 
  name: "ABATECH", // Use the name exactly as it appears in Brevo
  email: "vitalismakuochukwu@gmail.com" 
},
    to: [{ email: email }], // 'email' must be the parent's email from req.body
    subject: `Confirm your TinyMath Account: ${verificationCode}`,
    htmlContent: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <div style="background-color: #4A90E2; padding: 25px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">TinyMath Education</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #555;">To finish setting up your parent account, please use the 6-digit verification code below:</p>
          
          <div style="margin: 25px 0; background-color: #f0f7ff; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #4A90E2;">
            <span style="font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 12px;">${verificationCode}</span>
          </div>
          
          <p style="font-size: 14px; color: #888; text-align: center;">This code will expire in 10 minutes for your security.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 11px; color: #aaa; text-align: center;">Sent by ABATECH TinyMath System</p>
        </div>
      </div>`
  }, {
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  console.log(`✅ Success: Legit email sent to ${email}`);
    } catch (emailError) {
      console.error("Brevo Email Error:", emailError.response ? emailError.response.data : emailError.message);
      return res.status(500).json({ message: "Failed to send verification email." });
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
    
    // If user is not verified, generate a new code and send it immediately
    if (!user.isVerified) {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      try {
        await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { name: "TinyMath Support", email: "vitalismakuochukwu@gmail.com" },
          to: [{ email: email }],
          subject: `Activate Your Account: ${verificationCode}`,
          htmlContent: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #4A90E2; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">TinyMath Education</h1>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #555;">You tried to login, but your account isn't active yet. Use this code to verify:</p>
                
                <div style="margin: 25px 0; background-color: #f0f7ff; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #4A90E2;">
                  <span style="font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 12px;">${verificationCode}</span>
                </div>
                
                <p style="font-size: 14px; color: #888; text-align: center;">This code will expire in 1 hour.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 11px; color: #aaa; text-align: center;">Sent by ABATECH TinyMath System</p>
              </div>
            </div>`
        }, {
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
          }
        });
      } catch (e) { console.error("Auto-resend failed", e.message); }
      return res.status(400).json({ message: 'Account not verified. A new code has been sent to your email.' });
    }

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

    try {
      await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { name: "TinyMath Support", email: "vitalismakuochukwu@gmail.com" },
        to: [{ email: email }],
        subject: `New Verification Code: ${verificationCode}`,
        htmlContent: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #4A90E2; padding: 25px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">TinyMath Education</h1>
            </div>
            <div style="padding: 30px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #333;">Hello,</p>
              <p style="font-size: 16px; color: #555;">You requested a new code for your TinyMath account:</p>
              
              <div style="margin: 25px 0; background-color: #f0f7ff; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #4A90E2;">
                <span style="font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 12px;">${verificationCode}</span>
              </div>
              
              <p style="font-size: 14px; color: #888; text-align: center;">This code expires in 1 hour.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 11px; color: #aaa; text-align: center;">Sent by ABATECH TinyMath System</p>
            </div>
          </div>`
      }, {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
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

    try {
      await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { name: "TinyMath Support", email: "vitalismakuochukwu@gmail.com" },
        to: [{ email: email }],
        subject: `Reset Your TinyMath Password: ${resetCode}`,
        htmlContent: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #4A90E2; padding: 25px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">TinyMath Education</h1>
            </div>
            <div style="padding: 30px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #333;">Hello,</p>
              <p style="font-size: 16px; color: #555;">We received a request to reset your password. Use the code below:</p>
              
              <div style="margin: 25px 0; background-color: #f0f7ff; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #4A90E2;">
                <span style="font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 12px;">${resetCode}</span>
              </div>
              
              <p style="font-size: 14px; color: #888; text-align: center;">This code expires in 15 minutes.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 11px; color: #aaa; text-align: center;">Sent by ABATECH TinyMath System</p>
            </div>
          </div>`
      }, {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      return res.status(500).json({ message: "Failed to send reset email." });
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
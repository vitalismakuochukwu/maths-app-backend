const User = require('../models/User');
const Child = require('../models/Child');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
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
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 20px;">
                <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">TinyMath</h1>
                </div>
                <div style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; text-align: center;">Welcome! 🚀</h2>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">Thank you for registering. Please use the code below to verify your email address.</p>
                  
                  <div style="background-color: #f0f7ff; border: 1px solid #cce3ff; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; display: block;">${verificationCode}</span>
                  </div>

                  <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${frontendUrl}/verify-email?email=${email}&code=${verificationCode}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Account</a>
                  </div>
                  
                  <p style="color: #999999; font-size: 14px; text-align: center;">This code expires in 1 hour.</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="color: #aaaaaa; font-size: 12px; margin: 0;">If you didn't create an account, you can safely ignore this email.</p>
                </div>
              </div>
            </body>
            </html>
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
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 20px;">
                <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">TinyMath</h1>
                </div>
                <div style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; text-align: center;">New Verification Code</h2>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">You requested a new code for your TinyMath account.</p>
                  
                  <div style="background-color: #f0f7ff; border: 1px solid #cce3ff; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; display: block;">${verificationCode}</span>
                  </div>

                  <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${frontendUrl}/verify-email?email=${email}&code=${verificationCode}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Account</a>
                  </div>
                  
                  <p style="color: #999999; font-size: 14px; text-align: center;">This code expires in 1 hour.</p>
                </div>
              </div>
            </body>
            </html>
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
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 20px;">
                <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">TinyMath</h1>
                </div>
                <div style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; text-align: center;">Password Reset Request</h2>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; text-align: center;">Use the code below to reset your password.</p>
                  
                  <div style="background-color: #f0f7ff; border: 1px solid #cce3ff; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; display: block;">${resetCode}</span>
                  </div>

                  <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${frontendUrl}/reset-password?email=${email}&code=${resetCode}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Password</a>
                  </div>
                  
                  <p style="color: #999999; font-size: 14px; text-align: center;">This code expires in 15 minutes.</p>
                </div>
              </div>
            </body>
            </html>
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
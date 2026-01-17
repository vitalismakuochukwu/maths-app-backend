const express = require('express');
const router = express.Router();
const { register, verifyEmail, login, resendVerificationCode, updateProfile, getUser, updateProgress, addChild, getChildren, updateChildProgress, deleteChild, forgotPassword, resetPassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/resend-code', resendVerificationCode);
router.put('/update-profile', updateProfile);
router.get('/user/:id', getUser);
router.put('/update-progress', updateProgress);
router.post('/add-child', addChild);
router.get('/children/:parentId', getChildren);
router.put('/update-child-progress', updateChildProgress);
router.delete('/child/:id', deleteChild);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Person = require('../models/Person');

// GET /api/profile — get current user profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -twoFactorSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/profile — update profile (fullName, email)
router.put('/', auth, async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.userId } });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      updates.email = email.toLowerCase();
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password -twoFactorSecret');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/profile/password — change password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/profile/linked-person — link user to a person in the tree
router.put('/linked-person', auth, async (req, res) => {
  try {
    const { personId } = req.body;
    if (personId) {
      // Authorization: only allow linking to persons owned by this user
      const person = await Person.findOne({ _id: personId, userId: req.userId });
      if (!person) return res.status(404).json({ message: 'Person not found' });

      // Clear any previous link from other persons owned by this user
      await Person.updateMany({ userId: req.userId, linkedUserId: req.userId }, { linkedUserId: null });

      // Mark the person as linked to this user
      await Person.findByIdAndUpdate(personId, { linkedUserId: req.userId });
    } else {
      // Unlinking — clear any previous person link
      await Person.updateMany({ userId: req.userId, linkedUserId: req.userId }, { linkedUserId: null });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { linkedPersonId: personId || null },
      { new: true }
    ).select('-password -twoFactorSecret');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/profile/2fa/setup — generate a TOTP secret and QR code
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    const secret = speakeasy.generateSecret({
      name: `GenealogyTree (${user.username})`
    });

    // Save the temp secret (not yet verified/enabled)
    await User.findByIdAndUpdate(req.userId, { twoFactorSecret: secret.base32 });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qrCode: qrCodeUrl });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/profile/2fa/verify — verify TOTP and activate 2FA
router.post('/2fa/verify', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'TOTP token required' });

    const user = await User.findById(req.userId);
    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA setup not initiated' });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) return res.status(400).json({ message: 'Invalid TOTP token' });

    await User.findByIdAndUpdate(req.userId, { twoFactorEnabled: true });
    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/profile/2fa — disable 2FA
router.delete('/2fa', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'TOTP token required to disable 2FA' });

    const user = await User.findById(req.userId);
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) return res.status(400).json({ message: 'Invalid TOTP token' });

    await User.findByIdAndUpdate(req.userId, { twoFactorEnabled: false, twoFactorSecret: null });
    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

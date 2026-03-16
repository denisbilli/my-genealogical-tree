import React, { useState, useEffect } from 'react';
import { User, Lock, Shield, Link, CheckCircle, XCircle } from 'lucide-react';
import { profileService, personService } from '../services/api';
import Layout from '../components/Layout';

function Profile() {
  const [profile, setProfile] = useState(null);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Profile edit form
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '' });
  // Password form
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  // 2FA
  const [twoFAData, setTwoFAData] = useState(null); // { secret, qrCode }
  const [twoFAToken, setTwoFAToken] = useState('');
  const [disableToken, setDisableToken] = useState('');

  useEffect(() => {
    loadProfile();
    loadPersons();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await profileService.get();
      setProfile(res.data);
      setProfileForm({ fullName: res.data.fullName, email: res.data.email });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadPersons = async () => {
    try {
      const res = await personService.getAll();
      setPersons(res.data);
    } catch {
      // non-critical
    }
  };

  const showMsg = (msg) => { setMessage(msg); setError(''); setTimeout(() => setMessage(''), 4000); };
  const showErr = (msg) => { setError(msg); setMessage(''); setTimeout(() => setError(''), 4000); };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await profileService.update(profileForm);
      setProfile(res.data);
      // Update localStorage user
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...u, fullName: res.data.fullName, email: res.data.email }));
      }
      showMsg('Profile updated successfully');
    } catch (err) {
      showErr(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showErr('New passwords do not match');
    }
    try {
      await profileService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMsg('Password changed successfully');
    } catch (err) {
      showErr(err.response?.data?.message || 'Failed to change password');
    }
  };

  const handle2FASetup = async () => {
    try {
      const res = await profileService.setup2fa();
      setTwoFAData(res.data);
    } catch (err) {
      showErr(err.response?.data?.message || 'Failed to set up 2FA');
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    try {
      await profileService.verify2fa({ token: twoFAToken });
      setTwoFAData(null);
      setTwoFAToken('');
      showMsg('2FA enabled successfully!');
      loadProfile();
    } catch (err) {
      showErr(err.response?.data?.message || 'Invalid code');
    }
  };

  const handle2FADisable = async (e) => {
    e.preventDefault();
    try {
      await profileService.disable2fa({ token: disableToken });
      setDisableToken('');
      showMsg('2FA disabled');
      loadProfile();
    } catch (err) {
      showErr(err.response?.data?.message || 'Invalid code');
    }
  };

  const handleLinkPerson = async (personId) => {
    try {
      await profileService.linkPerson({ personId: personId || null });
      showMsg('Person linked successfully');
      loadProfile();
    } catch (err) {
      showErr(err.response?.data?.message || 'Failed to link person');
    }
  };

  if (loading) {
    return (
      <Layout title="Heritg.org">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-main)' }}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Heritg.org" showBackButton={true} backButtonText="Dashboard" backButtonPath="/dashboard">
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '1.75rem', fontWeight: 700 }}>
          Profile Settings
        </h1>

        {message && (
          <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', color: '#155724', padding: '12px 16px', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> {message}
          </div>
        )}
        {error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', color: '#721c24', padding: '12px 16px', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={16} /> {error}
          </div>
        )}

        {/* Profile Info */}
        <section style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} color="var(--primary)" /> Profile Information
          </h2>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>Username (read-only)</label>
              <input type="text" value={profile?.username || ''} readOnly style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', opacity: 0.7 }} />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>Full Name</label>
              <input
                type="text"
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                required
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                required
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </form>
        </section>

        {/* Change Password */}
        <section style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} color="var(--primary)" /> Change Password
          </h2>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                minLength="6"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              />
            </div>
            <button type="submit" className="btn btn-primary">Change Password</button>
          </form>
        </section>

        {/* Two-Factor Authentication */}
        <section style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="var(--primary)" /> Two-Factor Authentication (2FA)
          </h2>

          <div style={{ marginBottom: '1rem' }}>
            <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
              background: profile?.twoFactorEnabled ? '#d4edda' : '#f8d7da',
              color: profile?.twoFactorEnabled ? '#155724' : '#721c24'
            }}>
              {profile?.twoFactorEnabled ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {profile?.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
            </span>
          </div>

          {!profile?.twoFactorEnabled && !twoFAData && (
            <button className="btn btn-primary" onClick={handle2FASetup}>
              Set Up 2FA
            </button>
          )}

          {twoFAData && (
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <img src={twoFAData.qrCode} alt="2FA QR Code" style={{ display: 'block', margin: '0 auto 1rem', border: '8px solid white', borderRadius: '8px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Or enter the secret manually: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary)' }}>{twoFAData.secret}</code>
              </p>
              <form onSubmit={handle2FAVerify} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={twoFAToken}
                  onChange={(e) => setTwoFAToken(e.target.value)}
                  maxLength="6"
                  pattern="[0-9]{6}"
                  required
                  style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                />
                <button type="submit" className="btn btn-primary">Verify & Enable</button>
                <button type="button" className="btn" onClick={() => setTwoFAData(null)} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>Cancel</button>
              </form>
            </div>
          )}

          {profile?.twoFactorEnabled && (
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                Enter a TOTP code from your authenticator app to disable 2FA:
              </p>
              <form onSubmit={handle2FADisable} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="6-digit code"
                  value={disableToken}
                  onChange={(e) => setDisableToken(e.target.value)}
                  maxLength="6"
                  pattern="[0-9]{6}"
                  required
                  style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                />
                <button type="submit" className="btn" style={{ background: '#dc3545', color: 'white' }}>Disable 2FA</button>
              </form>
            </div>
          )}
        </section>

        {/* Link to Person */}
        <section style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link size={20} color="var(--primary)" /> Link to Family Tree Person
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Associate your account with a person in a family tree so others can see you are a real member.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={profile?.linkedPersonId || ''}
              onChange={(e) => handleLinkPerson(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            >
              <option value="">-- None --</option>
              {persons.map((p) => {
                const birthYear = p.birthDate ? (() => { const d = new Date(p.birthDate); return isNaN(d.getTime()) ? null : d.getFullYear(); })() : null;
                return (
                  <option key={p._id} value={p._id}>
                    {p.firstName} {p.lastName} {birthYear ? `(${birthYear})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {profile?.linkedPersonId && (
            <p style={{ color: 'var(--primary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              ✓ You are linked to a person in the tree.
            </p>
          )}
        </section>
      </div>
    </Layout>
  );
}

export default Profile;

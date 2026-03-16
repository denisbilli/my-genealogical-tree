import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import AuthLayout from '../components/AuthLayout';

function Login({ setIsAuthenticated }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await authService.login(formData);
      if (response.data.requiresTwoFactor) {
        // Enter 2FA step
        setTempToken(response.data.tempToken);
        setTwoFAStep(true);
      } else {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setIsAuthenticated(true);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await authService.verify2fa({ tempToken, token: twoFACode });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setIsAuthenticated(true);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid 2FA code. Please try again.');
    }
  };

  if (twoFAStep) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <h2>Two-Factor Authentication</h2>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Enter the 6-digit code from your authenticator app.
          </p>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handle2FASubmit}>
            <div className="form-group">
              <label>Authentication Code</label>
              <input
                type="text"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value)}
                placeholder="000000"
                maxLength="6"
                pattern="[0-9]{6}"
                required
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3em' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Verify</button>
          </form>
          <div className="auth-redirect">
            <button
              onClick={() => { setTwoFAStep(false); setTempToken(''); setTwoFACode(''); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ← Back to login
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <h2>Login to Genealogical Tree</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
        </form>
        <div className="auth-redirect">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default Login;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreeDeciduous, LogOut, Moon, Sun } from 'lucide-react';
import { authService } from '../services/api';

function Layout({ children, title = 'Heritg.org', showBackButton = false, backButtonText = '', backButtonPath = '' }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // Load dark mode preference from localStorage
  useEffect(() => {
    const darkModePreference = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkModePreference);
    if (darkModePreference) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-light)', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header sticky top-0 z-50">
        <div className="app-title">
          <TreeDeciduous size={24} color="var(--primary)" />
          <span>{title}</span>
        </div>
        
        <div className="flex items-center gap-4">
          {showBackButton && backButtonPath && (
            <button 
              onClick={() => navigate(backButtonPath)}
              className="btn btn-secondary text-xs"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)' }}
            >
              {backButtonText}
            </button>
          )}
          
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            {isDarkMode ? <Sun size={20} color="var(--primary)" /> : <Moon size={20} color="var(--primary)" />}
          </button>
          
          {user && (
            <>
              <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                Ciao, {user?.fullName || 'Utente'}
              </span>
              <button 
                onClick={handleLogout} 
                className="btn btn-danger p-2 rounded-full" 
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}

export default Layout;

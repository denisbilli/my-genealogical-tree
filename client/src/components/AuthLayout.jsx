import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function AuthLayout({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  return (
    <div className="auth-container">
      {/* Dark Mode Toggle in top-right corner */}
      <button
        onClick={toggleDarkMode}
        className="fixed top-4 right-4 p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-50"
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {isDarkMode ? <Sun size={24} color="var(--primary)" /> : <Moon size={24} color="var(--primary)" />}
      </button>
      
      {children}
    </div>
  );
}

export default AuthLayout;

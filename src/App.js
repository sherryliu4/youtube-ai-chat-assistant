import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import { getUser } from './services/mongoApi';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('chatapp_user');
    try {
      return JSON.parse(saved);
    } catch {
      return saved; // fallback or null
    }
  });

  // Hydrate user profile if missing firstName/lastName (legacy session)
  useEffect(() => {
    if (user) {
      const username = typeof user === 'string' ? user : user.username;
      const hasName = typeof user !== 'string' && user.firstName;
      
      if (!hasName) {
        getUser(username).then((userData) => {
          if (userData && userData.firstName) {
            const newUser = { 
              username, 
              firstName: userData.firstName, 
              lastName: userData.lastName 
            };
            localStorage.setItem('chatapp_user', JSON.stringify(newUser));
            setUser(newUser);
          }
        }).catch(() => {
          // If fetch fails, maybe user doesn't exist or network error, keep current state
        });
      }
    }
  }, [user]);

  const handleLogin = (userData) => {
    // userData is { username, firstName, lastName }
    localStorage.setItem('chatapp_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (user) {
    // Handle legacy string case if necessary, though we overwrite on login
    const username = typeof user === 'string' ? user : user.username;
    const firstName = typeof user === 'string' ? '' : user.firstName;
    
    return <Chat username={username} firstName={firstName} onLogout={handleLogout} />;
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;

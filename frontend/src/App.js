import React, { useState, createContext, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';
import './App.css';

export const DarkModeContext = createContext();
export const AuthContext = createContext();

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  if (!token) {
    return (
      <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
        <AuthContext.Provider value={{ setToken, setUser }}>
          <Toaster position="top-right" />
          <Login setToken={setToken} setUser={setUser} />
        </AuthContext.Provider>
      </DarkModeContext.Provider>
    );
  }

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <AuthContext.Provider value={{ token, setToken, user, setUser }}>
        <Toaster position="top-right" />
        <Dashboard />
      </AuthContext.Provider>
    </DarkModeContext.Provider>
  );
}

export default App;
import React, { useState, createContext, useContext } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';
import './App.css';

export const DarkModeContext = createContext();

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [darkMode, setDarkMode] = useState(false);
  
  if (!token) {
    return (
      <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
        <Toaster position="top-right" />
        <Login setToken={setToken} />
      </DarkModeContext.Provider>
    );
  }
  
  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <Toaster position="top-right" />
      <Dashboard token={token} setToken={setToken} />
    </DarkModeContext.Provider>
  );
}

export default App;
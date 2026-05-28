import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import './App.css';
import './styles/globals.css';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Create Contexts here directly to avoid import issues
export const AuthContext = React.createContext();
export const DarkModeContext = React.createContext();

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CircleChat = lazy(() => import('./pages/CircleChat'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <div className="spinner"></div>
  </div>
);

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.warn('Failed to parse saved user from localStorage:', error);
      return null;
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [authInitializing, setAuthInitializing] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Sync with Firebase Auth state: set token and user on login/logout
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setToken(idToken);
        setUser({ id: fbUser.uid, username: fbUser.displayName || fbUser.email });
      } else {
        setToken(null);
        setUser(null);
      }
      setAuthInitializing(false);
    });

    return () => unsubscribe();
  }, [setToken, setUser]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const authValue = { token, setToken, user, setUser };
  const darkModeValue = { darkMode, setDarkMode };

  if (authInitializing) {
    return (
      <AuthContext.Provider value={authValue}>
        <DarkModeContext.Provider value={darkModeValue}>
          <Toaster position="top-right" />
          <LoadingSpinner />
        </DarkModeContext.Provider>
      </AuthContext.Provider>
    );
  }

  if (!token) {
    return (
      <AuthContext.Provider value={authValue}>
        <DarkModeContext.Provider value={darkModeValue}>
          <Toaster position="top-right" />
          <Suspense fallback={<LoadingSpinner />}>
            <Login />
          </Suspense>
        </DarkModeContext.Provider>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={authValue}>
      <DarkModeContext.Provider value={darkModeValue}>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/circle/:circleId" element={<CircleChat />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DarkModeContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;

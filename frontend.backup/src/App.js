import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

export const AuthContext = React.createContext();
export const DarkModeContext = React.createContext();

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CircleChat = lazy(() => import('./pages/CircleChat'));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <div className="spinner"></div>
  </div>
);

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
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
  }, [darkMode]);

  if (!token) {
    return (
      <AuthContext.Provider value={{ setToken, setUser }}>
        <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
          <Toaster position="top-right" />
          <Suspense fallback={<LoadingSpinner />}>
            <Login />
          </Suspense>
        </DarkModeContext.Provider>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ token, setToken, user, setUser }}>
      <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/circle/:circleId" element={<CircleChat />} />
              <Route path="/circle/:circleId/meeting" element={<MeetingRoom />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DarkModeContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
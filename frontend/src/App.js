import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  if (!token) {
    return (
      <>
        <Toaster position="top-right" />
        <Login setToken={setToken} />
      </>
    );
  }
  
  return (
    <>
      <Toaster position="top-right" />
      <Dashboard token={token} setToken={setToken} />
    </>
  );
}

export default App;
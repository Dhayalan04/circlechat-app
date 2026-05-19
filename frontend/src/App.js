import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';

// Remove this line if present:
// import toast from 'react-hot-toast';  // DELETE THIS LINE

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
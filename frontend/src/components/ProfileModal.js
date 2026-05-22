import React, { useState, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../App';

const API_URL = 'https://circlechat-backend.onrender.com';

function ProfileModal({ onClose }) {
  const { token, setToken, setUser, user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    toast.success('Logged out');
    onClose();
  };
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '24px', width: '400px', maxWidth: '90%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <h3 style={{ color: 'white', marginTop: '12px' }}>{user?.username}</h3>
          <p style={{ color: 'rgba(255,255,255,0.8)' }}>Online</p>
        </div>
        
        <div style={{ padding: '20px' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
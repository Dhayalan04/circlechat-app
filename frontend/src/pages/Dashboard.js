import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import CircleChat from './CircleChat';
import API_URL from '../config';
import { DarkModeContext } from '../App';

function Dashboard({ token, setToken }) {
  const { darkMode, setDarkMode } = useContext(DarkModeContext);
  const [circles, setCircles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCircle, setSelectedCircle] = useState(null);
  
  const fetchCircles = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/circles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCircles(res.data);
    } catch (err) {
      toast.error('Failed to load circles');
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);
  
  const createCircle = async () => {
    if (!circleName.trim()) {
      toast.error('Please enter a circle name');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/circles`, 
        { name: circleName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Circle "${circleName}" created! Invite code: ${res.data.invite_code}`);
      setShowCreateModal(false);
      setCircleName('');
      fetchCircles();
    } catch (err) {
      toast.error('Failed to create circle');
    }
  };
  
  const joinCircle = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/circles/join`,
        { inviteCode: inviteCode.toUpperCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Joined circle!');
      setShowJoinModal(false);
      setInviteCode('');
      fetchCircles();
    } catch (err) {
      toast.error('Invalid invite code');
    }
  };
  
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };
  
  const openCircleChat = (circle) => {
    setSelectedCircle(circle);
  };
  
  if (selectedCircle) {
    return (
      <CircleChat 
        token={token} 
        circleId={selectedCircle.id} 
        onBack={() => setSelectedCircle(null)} 
      />
    );
  }
  
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div style={{ minHeight: '100vh', background: darkMode ? '#1a1a2e' : '#f3f4f6' }}>
        {/* Header */}
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          style={{ background: darkMode ? '#16213e' : 'white', borderBottom: `1px solid ${darkMode ? '#0f3460' : '#e5e7eb'}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h1 style={{ fontSize: '24px', margin: 0, color: '#3B82F6' }}>CircleChat</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setDarkMode(!darkMode)}
              style={{ padding: '8px 16px', background: darkMode ? '#f3f4f6' : '#1a1a2e', color: darkMode ? '#1a1a2e' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              {darkMode ? '☀️' : '🌙'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Logout
            </motion.button>
          </div>
        </motion.div>
        
        {/* Main content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + Create Circle
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowJoinModal(true)}
              style={{ padding: '12px 24px', background: darkMode ? '#0f3460' : 'white', border: `1px solid ${darkMode ? '#1a1a2e' : '#d1d5db'}`, borderRadius: '12px', cursor: 'pointer', color: darkMode ? 'white' : 'black' }}
            >
              Join Circle
            </motion.button>
          </div>
          
          <AnimatePresence>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <div className="skeleton" style={{ width: '200px', height: '20px', margin: '10px auto' }}></div>
                <div className="skeleton" style={{ width: '300px', height: '20px', margin: '10px auto' }}></div>
              </div>
            ) : circles.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', padding: '50px', background: darkMode ? '#16213e' : 'white', borderRadius: '16px', color: darkMode ? 'white' : 'black' }}
              >
                <p>No circles yet. Create your first circle!</p>
              </motion.div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {circles.map((circle, index) => (
                  <motion.div
                    key={circle.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    onClick={() => openCircleChat(circle)}
                    style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer', color: darkMode ? 'white' : 'black' }}
                  >
                    <h3 style={{ margin: '0 0 8px 0' }}>{circle.name}</h3>
                    <p style={{ margin: 0, color: darkMode ? '#aaa' : '#6b7280', fontSize: '14px' }}>Invite code: {circle.invite_code}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Modals with animations */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '24px', width: '400px', color: darkMode ? 'white' : 'black' }}
              >
                <h2 style={{ margin: '0 0 16px 0' }}>Create New Circle</h2>
                <input
                  type="text"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  placeholder="Circle name"
                  style={{ width: '100%', padding: '12px', border: `1px solid ${darkMode ? '#0f3460' : '#d1d5db'}`, background: darkMode ? '#0f3460' : 'white', color: darkMode ? 'white' : 'black', borderRadius: '12px', marginBottom: '24px' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={createCircle} style={{ padding: '8px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Create</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {showJoinModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '24px', width: '400px', color: darkMode ? 'white' : 'black' }}
              >
                <h2 style={{ margin: '0 0 16px 0' }}>Join Circle</h2>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter invite code"
                  style={{ width: '100%', padding: '12px', border: `1px solid ${darkMode ? '#0f3460' : '#d1d5db'}`, background: darkMode ? '#0f3460' : 'white', color: darkMode ? 'white' : 'black', borderRadius: '12px', marginBottom: '24px', textTransform: 'uppercase' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowJoinModal(false)} style={{ padding: '8px 16px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={joinCircle} style={{ padding: '8px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Join</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Dashboard;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import CircleChat from './CircleChat';
import API_URL from '../config';

function Dashboard({ token, setToken }) {
  const [circles, setCircles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCircle, setSelectedCircle] = useState(null);
  
  const fetchCircles = async () => {
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
  };
  
  useEffect(() => {
    fetchCircles();
  }, [token]);  // Add token to dependency array
  
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
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: '#3B82F6' }}>CircleChat</h1>
        <button onClick={logout} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => setShowCreateModal(true)} style={{ padding: '10px 20px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            + Create Circle
          </button>
          <button onClick={() => setShowJoinModal(true)} style={{ padding: '10px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
            Join Circle with Code
          </button>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
        ) : circles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', background: 'white', borderRadius: '12px' }}>
            <p>No circles yet. Create your first circle!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {circles.map((circle) => (
              <div 
                key={circle.id} 
                onClick={() => openCircleChat(circle)}
                style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}
              >
                <h3 style={{ margin: '0 0 8px 0' }}>{circle.name}</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Invite code: {circle.invite_code}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Create New Circle</h2>
            <input
              type="text"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              placeholder="Circle name"
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '24px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createCircle} style={{ padding: '8px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Create</button>
            </div>
          </div>
        </div>
      )}
      
      {showJoinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Join Circle</h2>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code (e.g., ABC123)"
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '24px', textTransform: 'uppercase' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowJoinModal(false)} style={{ padding: '8px 16px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={joinCircle} style={{ padding: '8px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Join</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
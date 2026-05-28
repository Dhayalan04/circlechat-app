import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiPlus, FiUsers, FiCopy, FiSettings } from 'react-icons/fi';
import CircleChat from './CircleChat';
import ProfileModal from '../components/ProfileModal';
import { AuthContext, DarkModeContext } from '../App';

const API_URL = 'https://circlechat-backend.onrender.com';

function Dashboard() {
  const { token, user } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);
  const [circles, setCircles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
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
      toast.success(`Circle created! Invite code: ${res.data.invite_code}`);
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
  
  const copyInviteCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };
  
  if (selectedCircle) {
    return <CircleChat circleId={selectedCircle.id} onBack={() => setSelectedCircle(null)} />;
  }
  
  return (
    <div style={{ display: 'flex', height: '100vh', background: darkMode ? '#1a1a2e' : '#f0f2f5' }}>
      {/* Sidebar */}
      <div style={{ width: '300px', background: darkMode ? '#16213e' : 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ color: '#667eea' }}>CircleChat</h2>
        </div>
        
        <div style={{ padding: '16px' }}>
          <button onClick={() => setShowCreateModal(true)} style={{ width: '100%', padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '12px', marginBottom: '12px', cursor: 'pointer' }}>
            <FiPlus /> New Circle
          </button>
          <button onClick={() => setShowJoinModal(true)} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #667eea', color: '#667eea', borderRadius: '12px', cursor: 'pointer' }}>
            <FiUsers /> Join Circle
          </button>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <h4 style={{ marginBottom: '12px', color: '#6c757d' }}>Your Circles</h4>
          {loading ? (
            <p>Loading...</p>
          ) : circles.length === 0 ? (
            <p style={{ color: '#6c757d' }}>No circles yet. Create one!</p>
          ) : (
            circles.map(circle => (
              <div key={circle.id} onClick={() => setSelectedCircle(circle)} style={{ padding: '12px', marginBottom: '8px', background: darkMode ? '#0f3460' : '#f8f9fa', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{circle.name}</strong>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>{circle.member_count || 1} members</div>
                </div>
                <button onClick={(e) => copyInviteCode(circle.invite_code, e)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>📋</button>
              </div>
            ))
          )}
        </div>
        
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={() => setShowProfileModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', background: '#667eea', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div>{user?.username}</div>
              <div style={{ fontSize: '12px', color: '#4ade80' }}>Online</div>
            </div>
            <FiSettings />
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <h1>Welcome back, {user?.username}!</h1>
        <p>Select a circle to start messaging</p>
        {circles.length === 0 && (
          <div style={{ marginTop: '20px' }}>
            <button onClick={() => setShowCreateModal(true)} style={{ padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '12px', marginRight: '12px', cursor: 'pointer' }}>Create Circle</button>
            <button onClick={() => setShowJoinModal(true)} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid #667eea', color: '#667eea', borderRadius: '12px', cursor: 'pointer' }}>Join Circle</button>
          </div>
        )}
      </div>
      
      {/* Modals */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '400px' }} onClick={e => e.stopPropagation()}>
            <h3>Create Circle</h3>
            <input type="text" value={circleName} onChange={e => setCircleName(e.target.value)} placeholder="Circle name" style={{ width: '100%', padding: '12px', margin: '16px 0', border: '1px solid #ddd', borderRadius: '8px' }} autoFocus />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createCircle} style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Create</button>
            </div>
          </div>
        </div>
      )}
      
      {showJoinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowJoinModal(false)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '400px' }} onClick={e => e.stopPropagation()}>
            <h3>Join Circle</h3>
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Invite code" style={{ width: '100%', padding: '12px', margin: '16px 0', border: '1px solid #ddd', borderRadius: '8px' }} autoFocus />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowJoinModal(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={joinCircle} style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Join</button>
            </div>
          </div>
        </div>
      )}
      
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </div>
  );
}

export default Dashboard;
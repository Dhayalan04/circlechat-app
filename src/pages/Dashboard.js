import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiUsers, FiCopy, FiHome, FiUser, FiSettings, FiSun, FiMoon, FiLogOut } from 'react-icons/fi';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import CircleChat from './CircleChat';
import ProfileModal from '../components/ProfileModal';
import API_URL from '../config';
import { DarkModeContext, AuthContext } from '../App';

function Dashboard() {
  const { darkMode, setDarkMode } = useContext(DarkModeContext);
  const { token, user, setToken, setUser } = useContext(AuthContext);
  const [circles, setCircles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [activeTab, setActiveTab] = useState('chats');
  
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

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('Firebase sign out failed:', err.message);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);
  
  const createCircle = async () => {
    if (!circleName.trim()) {
      toast.error('Please enter a circle name');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/circles`, 
        { name: circleName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Circle "${circleName}" created!`);
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
    <div className={`dashboard-container ${darkMode ? 'dark' : ''}`}>
      {/* Desktop Sidebar */}
      <div className="sidebar" style={{ display: window.innerWidth >= 768 ? 'flex' : 'none' }}>
        <div className="sidebar-header">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#0088cc"/>
              <circle cx="8" cy="10" r="2" fill="white"/>
              <circle cx="16" cy="10" r="2" fill="white"/>
            </svg>
            <span>CircleChat</span>
          </div>
        </div>
        
        <div className="sidebar-actions">
          <button onClick={() => setShowCreateModal(true)} className="action-btn primary"><FiPlus /> New Circle</button>
          <button onClick={() => setShowJoinModal(true)} className="action-btn secondary"><FiUsers /> Join Circle</button>
        </div>
        
        <div className="circles-list">
          <h3>Your Circles</h3>
          {loading ? (
            <div className="skeleton-list"><div className="skeleton"></div><div className="skeleton"></div></div>
          ) : circles.length === 0 ? (
            <div className="empty-state"><p>No circles yet</p><span>Create or join a circle</span></div>
          ) : (
            circles.map((circle) => (
              <motion.div key={circle.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="circle-item" onClick={() => setSelectedCircle(circle)}>
                <div className="circle-avatar"><FiUsers /></div>
                <div className="circle-info"><h4>{circle.name}</h4><span>{circle.member_count || 1} members</span></div>
                <div className="circle-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => copyInviteCode(circle.invite_code, e)} title="Copy invite code"><FiCopy /></button>
                </div>
              </motion.div>
            ))
          )}
        </div>
        
        <div className="sidebar-footer">
          <button onClick={() => setShowProfileModal(true)} className="profile-btn">
            <div className="profile-avatar">{user?.avatar ? <img src={user.avatar} alt={user?.username} /> : <span>{user?.username?.[0]?.toUpperCase() || 'U'}</span>}</div>
            <div className="profile-info"><span className="username">{user?.username}</span><span className="status">Online</span></div>
            <FiSettings />
          </button>
        </div>
      </div>
      
      {/* Mobile Main Content */}
      <div className="main-content">
        {/* Profile Header for Mobile */}
        <div className="profile-header">
          <div className="profile-info-header" onClick={() => setShowProfileModal(true)}>
            <div className="profile-avatar-header">
              {user?.avatar ? <img src={user.avatar} alt={user?.username} /> : <span>{user?.username?.[0]?.toUpperCase() || 'U'}</span>}
            </div>
            <div className="profile-text">
              <h3>{user?.username}</h3>
              <p>Online</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="settings-btn" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <FiSun /> : <FiMoon />}
            </button>
            <button className="settings-btn" onClick={handleLogout} title="Sign Out">
              <FiLogOut />
            </button>
          </div>
        </div>
        
        <div className="welcome-section">
          <h1>Welcome back!</h1>
          <p>Select a circle to start messaging</p>
        </div>
        
        <div className="action-buttons">
          <button onClick={() => setShowCreateModal(true)} className="action-btn primary"><FiPlus /> New Circle</button>
          <button onClick={() => setShowJoinModal(true)} className="action-btn secondary"><FiUsers /> Join</button>
        </div>
        
        <div className="circles-grid">
          {loading ? (
            <div className="skeleton-list"><div className="skeleton"></div><div className="skeleton"></div></div>
          ) : circles.length === 0 ? (
            <div className="empty-state"><p>No circles yet</p><span>Create or join a circle to start</span></div>
          ) : (
            circles.map((circle) => (
              <motion.div
                key={circle.id}
                whileTap={{ scale: 0.98 }}
                className="circle-card"
                onClick={() => setSelectedCircle(circle)}
              >
                <div className="card-avatar"><FiUsers /></div>
                <div className="card-info">
                  <h3>{circle.name}</h3>
                  <p>{circle.member_count || 1} members</p>
                  <div className="invite-code">{circle.invite_code}</div>
                </div>
                <button onClick={(e) => copyInviteCode(circle.invite_code, e)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>📋</button>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="bottom-nav">
        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>
          <FiHome size={20} />
          <span>Chats</span>
        </button>
        <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setShowProfileModal(true)}>
          <FiUser size={20} />
          <span>Profile</span>
        </button>
      </div>
      
      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal onClose={() => setShowCreateModal(false)} title="Create New Circle" darkMode={darkMode}>
            <input type="text" value={circleName} onChange={(e) => setCircleName(e.target.value)} placeholder="Circle name" autoFocus />
            <div className="modal-actions"><button onClick={() => setShowCreateModal(false)} className="secondary">Cancel</button><button onClick={createCircle} className="primary">Create</button></div>
          </Modal>
        )}
        
        {showJoinModal && (
          <Modal onClose={() => setShowJoinModal(false)} title="Join Circle" darkMode={darkMode}>
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter invite code" autoFocus />
            <div className="modal-actions"><button onClick={() => setShowJoinModal(false)} className="secondary">Cancel</button><button onClick={joinCircle} className="primary">Join</button></div>
          </Modal>
        )}
        
        {showProfileModal && (
          <ProfileModal onClose={() => setShowProfileModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, onClose, title, darkMode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`modal-content ${darkMode ? 'dark' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>{title}</h2><button onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export default Dashboard;
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLogOut, FiPlus, FiUsers, FiCopy, FiTrash2, FiSettings, FiX } from 'react-icons/fi';
import CircleChat from './CircleChat';
import ProfileModal from '../components/ProfileModal';
import API_URL from '../config';
import { DarkModeContext, AuthContext } from '../App';

function Dashboard() {
  const { darkMode } = useContext(DarkModeContext);
  const { token, user } = useContext(AuthContext);
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
  
  const leaveCircle = async (circleId, circleName) => {
    if (window.confirm(`Are you sure you want to leave "${circleName}"?`)) {
      try {
        await axios.delete(`${API_URL}/api/circles/${circleId}/leave`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(`Left "${circleName}"`);
        fetchCircles();
      } catch (err) {
        toast.error('Failed to leave circle');
      }
    }
  };
  
  const deleteCircle = async (circleId, circleName) => {
    if (window.confirm(`Delete "${circleName}"? This cannot be undone.`)) {
      try {
        await axios.delete(`${API_URL}/api/circles/${circleId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(`"${circleName}" deleted`);
        fetchCircles();
      } catch (err) {
        toast.error('Failed to delete circle');
      }
    }
  };
  
  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };
  
  if (selectedCircle) {
    return <CircleChat circleId={selectedCircle.id} onBack={() => setSelectedCircle(null)} />;
  }
  
  return (
    <div className={`dashboard-container ${darkMode ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
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
                  <button onClick={() => copyInviteCode(circle.invite_code)} title="Copy invite code"><FiCopy /></button>
                  <button onClick={() => leaveCircle(circle.id, circle.name)} title="Leave circle"><FiLogOut /></button>
                  {circle.created_by === user?.id && <button onClick={() => deleteCircle(circle.id, circle.name)} title="Delete circle"><FiTrash2 /></button>}
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
      </aside>
      
      <main className="dashboard-main">
        <div className="welcome-section"><h1>Welcome back, {user?.username}!</h1><p>Select a circle to start messaging</p></div>
        {circles.length > 0 && (
          <div className="recent-circles">
            <h2>Recent Circles</h2>
            <div className="circles-grid">
              {circles.slice(0, 4).map((circle) => (
                <motion.div key={circle.id} whileHover={{ y: -5 }} className="circle-card" onClick={() => setSelectedCircle(circle)}>
                  <div className="card-avatar"><FiUsers /></div>
                  <h3>{circle.name}</h3>
                  <p>{circle.member_count || 1} members</p>
                  <span className="invite-code">{circle.invite_code}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>
      
      <AnimatePresence>
        {showCreateModal && <Modal onClose={() => setShowCreateModal(false)} title="Create New Circle" darkMode={darkMode}>
          <input type="text" value={circleName} onChange={(e) => setCircleName(e.target.value)} placeholder="Circle name" autoFocus />
          <div className="modal-actions"><button onClick={() => setShowCreateModal(false)} className="secondary">Cancel</button><button onClick={createCircle} className="primary">Create</button></div>
        </Modal>}
        {showJoinModal && <Modal onClose={() => setShowJoinModal(false)} title="Join Circle" darkMode={darkMode}>
          <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter invite code" autoFocus />
          <div className="modal-actions"><button onClick={() => setShowJoinModal(false)} className="secondary">Cancel</button><button onClick={joinCircle} className="primary">Join</button></div>
        </Modal>}
        {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, onClose, title, darkMode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`modal-content ${darkMode ? 'dark' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>{title}</h2><button onClick={onClose}><FiX /></button></div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export default Dashboard;
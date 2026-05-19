import React, { useState, useContext, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FiCamera, FiSave, FiX, FiLock, FiUser, FiEdit2, FiLogOut } from 'react-icons/fi';
import API_URL from '../config';
import { AuthContext, DarkModeContext } from '../App';

function ProfileModal({ onClose }) {
  const { token, user, setUser, setToken } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);
  const [loading, setLoading] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
      const res = await axios.post(`${API_URL}/api/upload-avatar`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setAvatar(res.data.url);
      setAvatarPreview(res.data.url);
      setUser({ ...user, avatar: res.data.url });
      localStorage.setItem('user', JSON.stringify({ ...user, avatar: res.data.url }));
      toast.success('Profile picture updated!');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      toast.error('Username cannot be empty');
      return;
    }
    
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/user/username`, 
        { username: newUsername },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser({ ...user, username: newUsername });
      localStorage.setItem('user', JSON.stringify({ ...user, username: newUsername }));
      toast.success('Username updated!');
      setIsEditingUsername(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update username');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/user/password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Password updated! Please login again');
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      toast.success('Logged out successfully');
      onClose();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className={`profile-modal ${darkMode ? 'dark' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <button onClick={onClose}><FiX /></button>
        </div>
        
        <div className="profile-avatar-section">
          <div className="avatar-wrapper">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <button className="change-avatar-btn" onClick={() => fileInputRef.current?.click()}>
              <FiCamera />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>
          <h3>{user?.username}</h3>
          <p>Online</p>
        </div>
        
        <div className="profile-section">
          <div className="section-header">
            <FiUser />
            <h4>Username</h4>
          </div>
          {isEditingUsername ? (
            <div className="edit-field">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoFocus
              />
              <div className="edit-actions">
                <button onClick={() => setIsEditingUsername(false)}>Cancel</button>
                <button onClick={handleUpdateUsername} disabled={loading}>Save</button>
              </div>
            </div>
          ) : (
            <div className="info-row">
              <span>{user?.username}</span>
              <button onClick={() => setIsEditingUsername(true)}><FiEdit2 /></button>
            </div>
          )}
        </div>
        
        <div className="profile-section">
          <div className="section-header">
            <FiLock />
            <h4>Password</h4>
          </div>
          {isEditingPassword ? (
            <div className="edit-field">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <div className="edit-actions">
                <button onClick={() => setIsEditingPassword(false)}>Cancel</button>
                <button onClick={handleUpdatePassword} disabled={loading}>Update</button>
              </div>
            </div>
          ) : (
            <div className="info-row">
              <span>••••••••</span>
              <button onClick={() => setIsEditingPassword(true)}><FiEdit2 /></button>
            </div>
          )}
        </div>
        
        <div className="profile-footer">
          <button onClick={handleLogout} className="logout-btn">
            <FiLogOut /> Logout
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ProfileModal;
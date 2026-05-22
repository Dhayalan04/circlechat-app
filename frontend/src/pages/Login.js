import React, { useState, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../App';

function Login() {
  const { setToken, setUser } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const url = `https://circlechat-backend.onrender.com/api/${isLogin ? 'login' : 'signup'}`;
      const response = await axios.post(url, { username, password });
      
      if (response.data.token) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        toast.success(isLogin ? 'Welcome back!' : 'Account created!');
        window.location.href = '/';
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
    }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
              <circle cx="8" cy="10" r="2" fill="#667eea"/>
              <circle cx="16" cy="10" r="2" fill="#667eea"/>
            </svg>
          </div>
          <h1 style={{ color: 'white', fontSize: '42px' }}>CircleChat</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)' }}>Connect with your circles</p>
        </div>
        
        <div style={{ background: 'white', borderRadius: '24px', padding: '32px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '16px' }}
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{ width: '100%', padding: '14px', marginBottom: '24px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '16px' }}
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', background: '#007aff', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: '#007aff', cursor: 'pointer' }}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
import React from 'react';

const LoadingSpinner = () => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#f5f5f7'
    }}>
      <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
    </div>
  );
};

export default LoadingSpinner;
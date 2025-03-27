import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      backgroundColor: '#2563eb',
      color: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
          MATO
        </Link>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/maps" style={{ color: 'white', textDecoration: 'none' }}>
          맵 목록
        </Link>
        {user ? (
          <>
            <Link to="/my-maps" style={{ color: 'white', textDecoration: 'none' }}>
              내 맵 목록
            </Link>
            <Link to="/create-map" style={{ color: 'white', textDecoration: 'none' }}>
              맵 만들기
            </Link>
            <button 
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid white',
                borderRadius: '4px',
                padding: '0.25rem 0.75rem',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link 
              to="/login" 
              style={{ 
                color: 'white', 
                textDecoration: 'none',
                padding: '0.25rem 0.75rem',
                border: '1px solid white',
                borderRadius: '4px'
              }}
            >
              로그인
            </Link>
            <Link 
              to="/signup" 
              style={{ 
                color: '#2563eb', 
                textDecoration: 'none',
                backgroundColor: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '4px'
              }}
            >
              회원가입
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar; 
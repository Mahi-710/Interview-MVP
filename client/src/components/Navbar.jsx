import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = () => {
    setShowLogoutMenu(false);
    logout();
    navigate('/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showLogoutMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowLogoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogoutMenu]);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <img
          src={logo}
          alt="HireCraft"
          className="navbar-logo"
          onClick={() => navigate(user ? '/setup' : '/')}
        />
        <div className="navbar-links">
          <span className="navbar-link" onClick={() => navigate(user ? '/setup' : '/')}>Home</span>
          {user && (
            <div className="navbar-avatar-wrap" ref={menuRef}>
              <div className="navbar-avatar" onClick={() => setShowLogoutMenu((v) => !v)} title={user.name}>
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="navbar-avatar-img" referrerPolicy="no-referrer" />
                ) : (
                  <span className="navbar-avatar-initials">
                    {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              {showLogoutMenu && (
                <div className="navbar-dropdown">
                  <div className="navbar-dropdown-header">
                    <span className="navbar-dropdown-name">{user.name}</span>
                    <span className="navbar-dropdown-email">{user.email}</span>
                  </div>
                  <div className="navbar-dropdown-divider" />
                  <button className="navbar-dropdown-item logout" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

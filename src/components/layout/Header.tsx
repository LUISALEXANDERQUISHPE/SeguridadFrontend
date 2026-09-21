import React from 'react';

interface HeaderProps {
  authenticated?: boolean;
  username?: string;
  onSignOut?: () => void;
  currentPage?: 'home' | 'editor';
  onNavigate?: (page: 'home' | 'editor') => void;
}

export const Header: React.FC<HeaderProps> = ({
  authenticated = false,
  username,
  onSignOut,
  currentPage = 'home',
  onNavigate,
}) => {
  return (
    <header className="app-header">
      <div className="flex items-center gap-6">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate?.('home')}
          role="button"
          tabIndex={0}
        >
          <div className="brand-mark">S</div>
          <span className="brand-name">Secureleaf</span>
        </div>
        <nav className="header-nav">
          <button
            type="button"
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate?.('home')}
          >
            Inicio
          </button>
          <button
            type="button"
            className={`nav-link ${currentPage === 'editor' ? 'active' : ''}`}
            onClick={() => onNavigate?.('editor')}
          >
            Editor
          </button>
        </nav>
      </div>
      {authenticated && (
        <div className="header-account">
          <span>{username}</span>
          <button type="button" onClick={onSignOut}>
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;


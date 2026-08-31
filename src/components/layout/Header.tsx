import React from 'react';

interface HeaderProps {
  authenticated?: boolean;
  username?: string;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ authenticated = false, username, onSignOut }) => {
  return (
    <header className="app-header">
      <div className="flex items-center gap-2">
        <div className="brand-mark">S</div>
        <span className="brand-name">Secureleaf</span>
      </div>
      {authenticated && <div className="header-account"><span>{username}</span><button type="button" onClick={onSignOut}>Cerrar sesión</button></div>}
    </header>
  );
};

export default Header;


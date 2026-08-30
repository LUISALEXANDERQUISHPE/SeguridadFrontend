import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          S
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-900">Proyecto Seguridad</span>
      </div>
      <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
        <a href="#" className="hover:text-blue-600 transition-colors">Inicio</a>
        <a href="#" className="hover:text-blue-600 transition-colors">Nosotros</a>
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Conectado</span>
      </nav>
    </header>
  );
};

export default Header;


import React, { useState } from 'react';
import Button from '../../../components/common/Button';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Iniciando sesión con: ${email}`);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-md border border-slate-100">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Iniciar Sesión</h2>
        <p className="text-sm text-slate-500 mt-1">Ingresa tus credenciales para acceder</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Correo Electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="usuario@ejemplo.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="••••••••"
            required
          />
        </div>

        <Button type="submit" variant="primary" fullWidth className="mt-2">
          Ingresar
        </Button>
      </form>
    </div>
  );
};

export default LoginForm;


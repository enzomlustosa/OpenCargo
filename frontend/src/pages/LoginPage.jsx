import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, KeyRound, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onLoginSuccess }) {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');

    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage('Informe o seu código de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      await login(trimmed);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao validar código no ESP32.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-4">
      <div className="bg-white border border-neutral-200 rounded p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-700 mb-3">
            <Lock className="w-3.5 h-3.5" />
            Autenticação no ESP32
          </div>
          <h1 className="text-xl font-bold text-neutral-900 m-0">
            Acesso ao Sistema OpenCargo
          </h1>
          <p className="text-xs text-neutral-600 mt-1.5 mb-0 leading-relaxed">
            Informe seu código individual para consultar suas permissões e destrancar portas autorizadas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-access-code"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              Código de acesso
            </label>
            <input
              id="login-access-code"
              type="password"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Digite seu código de 5 dígitos"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded border border-neutral-300 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 box-border"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded border border-red-300 bg-red-50 text-red-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="w-full py-2.5 px-4 rounded border-0 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? 'Validando no ESP32...' : 'Entrar no Painel'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-neutral-200">
          <div className="text-xs text-neutral-600 mb-3">
            Precisa solicitar a abertura rápida de uma porta específica sem iniciar sessão?
          </div>
          <Link
            to="/access"
            className="w-full py-2.5 px-4 rounded border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-semibold no-underline inline-flex items-center justify-center gap-2 box-border transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            Ir para Acesso avulso
          </Link>
        </div>
      </div>
    </div>
  );
}

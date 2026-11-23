import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Shield, UserCheck } from 'lucide-react';
import Brand from './Brand';
import StatusIndicator from './StatusIndicator';
import { useAuth } from '../context/AuthContext';
import { setApiMode } from '../services/api';

export default function AppLayout({
  children,
  statusData,
  isConnected,
  isChecking,
  connectionError,
  onRetry,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  function handleSwitchToSimulator() {
    setApiMode('simulator');
    if (onRetry) {
      setTimeout(() => onRetry(), 30);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 font-sans">
      {/* Barra superior de status do ESP32 e modo de conexão */}
      <StatusIndicator
        statusData={statusData}
        isConnected={isConnected}
        isChecking={isChecking}
        onRetry={onRetry}
      />

      {/* Cabeçalho principal */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <Brand to={isAuthenticated ? '/dashboard' : '/'} />

          <nav className="flex flex-wrap items-center gap-2">
            {isAuthenticated ? (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-100 border border-neutral-200 text-xs">
                  <UserCheck className="w-4 h-4 text-neutral-700" />
                  <span className="font-semibold text-neutral-900">{user.name}</span>
                  <span className="text-neutral-400">|</span>
                  <span className="text-neutral-600 font-medium">{user.role}</span>
                </div>

                {location.pathname !== '/dashboard' && (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium no-underline"
                  >
                    Painel de Portas
                  </Link>
                )}

                {user.isAdmin && location.pathname !== '/admin' && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-semibold no-underline"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Administração
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </>
            ) : (
              <>
                {location.pathname !== '/' && (
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium no-underline"
                  >
                    Login
                  </Link>
                )}
                {location.pathname !== '/access' && (
                  <Link
                    to="/access"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium no-underline"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Acesso avulso
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Aviso claro quando o ESP32 Real estiver desconectado */}
      {!isConnected && connectionError && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900">
            <div>
              <strong className="font-semibold">ESP32 desconectado:</strong> {connectionError}
              <span className="block text-red-700 mt-0.5">
                Se estiver usando o Wokwi Web gratuito (sem Private Gateway), você pode ativar o Simulador Local da API para testar a interface.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded border border-red-300 bg-white text-red-900 hover:bg-red-100 font-medium cursor-pointer text-xs"
                >
                  Tentar novamente
                </button>
              )}
              <button
                type="button"
                onClick={handleSwitchToSimulator}
                className="px-3 py-1.5 rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 font-medium cursor-pointer text-xs"
              >
                Usar Simulador Local
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {children}
      </main>

      {/* Rodapé acadêmico discreto */}
      <footer className="border-t border-neutral-200 bg-white py-3 text-center text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>OpenCargo</strong> — Protótipo Acadêmico de Controle de Acesso Industrial (ESP32 + React + Wokwi)
          </span>
          <span>Comunicação HTTP/JSON sem persistência (Memória RAM)</span>
        </div>
      </footer>
    </div>
  );
}

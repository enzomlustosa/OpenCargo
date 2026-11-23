import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import AccessPage from './pages/AccessPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import { fetchSystemStatus, subscribeApiConfig } from './services/api';

function AppRoutes() {
  const [statusData, setStatusData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [rebootNotice, setRebootNotice] = useState('');

  const isFetchingRef = useRef(false);
  const lastUptimeRef = useRef(0);

  const refreshStatus = useCallback(async (isBackground = false) => {
    if (isFetchingRef.current && isBackground) return;
    isFetchingRef.current = true;

    if (!isBackground) {
      setIsChecking(true);
    }

    try {
      const data = await fetchSystemStatus();

      // Detecta se o ESP32 reiniciou (uptime atual menor que o último uptime registrado)
      if (lastUptimeRef.current > 0 && data.uptimeMs < lastUptimeRef.current) {
        setRebootNotice(
          'Reinício do ESP32 detectado: os dados em memória RAM (usuários e histórico) foram restaurados ao estado inicial.'
        );
      }
      lastUptimeRef.current = data.uptimeMs || 0;

      setStatusData(data);
      setIsConnected(true);
      setConnectionError('');
    } catch (error) {
      setIsConnected(false);
      setConnectionError(error.message || 'Falha ao comunicar com o ESP32.');
    } finally {
      isFetchingRef.current = false;
      if (!isBackground) {
        setIsChecking(false);
      }
    }
  }, []);

  // Busca inicial e polling periódico a cada 2 segundos sem empilhar requisições
  useEffect(() => {
    refreshStatus(false);
    const intervalId = setInterval(() => {
      refreshStatus(true);
    }, 2000);
    return () => clearInterval(intervalId);
  }, [refreshStatus]);

  // Atualiza imediatamente se o usuário alternar o modo da API ou reiniciar o simulador
  useEffect(() => {
    return subscribeApiConfig(() => {
      refreshStatus(false);
    });
  }, [refreshStatus]);

  return (
    <AppLayout
      statusData={statusData}
      isConnected={isConnected}
      isChecking={isChecking}
      connectionError={connectionError}
      onRetry={() => refreshStatus(false)}
    >
      {rebootNotice && (
        <div className="mb-6 p-3.5 rounded border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center justify-between gap-3">
          <span>
            <strong>Aviso de Sistema:</strong> {rebootNotice}
          </span>
          <button
            type="button"
            onClick={() => setRebootNotice('')}
            className="text-xs font-semibold underline bg-transparent border-0 cursor-pointer text-amber-900"
          >
            Entendi
          </button>
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={<LoginPage onLoginSuccess={() => refreshStatus(false)} />}
        />
        <Route
          path="/access"
          element={
            <AccessPage
              statusData={statusData}
              isConnected={isConnected}
              onActionCompleted={() => refreshStatus(false)}
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              statusData={statusData}
              isConnected={isConnected}
              onActionCompleted={() => refreshStatus(false)}
            />
          }
        />
        <Route
          path="/admin"
          element={
            <AdminPage
              statusData={statusData}
              isConnected={isConnected}
              onActionCompleted={() => refreshStatus(false)}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  LogOut,
  Radio,
  Shield,
  ShieldAlert,
  User,
} from 'lucide-react';
import DoorTable from '../components/DoorTable';
import { useAuth } from '../context/AuthContext';
import { acknowledgeSensorAlert, requestDoorAccess } from '../services/api';

export default function DashboardPage({
  statusData,
  isConnected,
  onActionCompleted,
}) {
  const { user, accessCode, isAuthenticated, logout } = useAuth();

  const [unlockingDoorId, setUnlockingDoorId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isAckLoading, setIsAckLoading] = useState(false);

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  const doors = statusData?.doors || [];
  const sensor = statusData?.sensor || null;
  const unlockedCount = doors.filter((d) => d.unlocked).length;

  async function handleUnlockDoor(door) {
    setUnlockingDoorId(door.id);
    setFeedback(null);

    try {
      // Envia o código do usuário e o ID da porta ao ESP32 para validação real no firmware
      const response = await requestDoorAccess({
        code: accessCode,
        doorId: door.id,
        mode: 'panel',
      });

      setFeedback({
        type: 'success',
        message: `${door.name}: ${response.message || 'Acesso autorizado. Porta destrancada.'}`,
      });

      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: `${door.name}: ${error.message || 'Acesso negado pelo ESP32.'}`,
      });
      if (onActionCompleted) {
        onActionCompleted();
      }
    } finally {
      setUnlockingDoorId(null);
    }
  }

  async function handleAckSensorAlert() {
    setIsAckLoading(true);
    try {
      await acknowledgeSensorAlert();
      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'Não foi possível redefinir o alerta do sensor.',
      });
    } finally {
      setIsAckLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cartão de Identificação do Usuário Autenticado */}
      <div className="bg-white border border-neutral-200 rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded bg-neutral-900 text-white flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-neutral-900 m-0">{user.name}</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-neutral-100 border border-neutral-300 text-neutral-800">
                Cargo: {user.role}
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-1 mb-0">
              Painel de controle de fechaduras. Cada solicitação de destrancamento é revalidada pelo ESP32.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user.isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-semibold no-underline"
            >
              <Shield className="w-3.5 h-3.5" />
              Painel Administrativo
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </div>

      {/* Painel de Monitoramento IoT: Sensor Físico + Estado dos Atuadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold uppercase">
            <span>Sensor de Porta (GPIO {sensor?.pin ?? 33})</span>
            <Radio className="w-4 h-4 text-neutral-700" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-neutral-900">
              {sensor ? (sensor.triggered ? 'ABERTA (LOW)' : 'FECHADA (HIGH)') : 'Aguardando...'}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                sensor?.triggered
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-300'
              }`}
            >
              {sensor?.state || '---'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded p-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold uppercase">
            <span>Atuadores (4 Fechaduras LED)</span>
            <Cpu className="w-4 h-4 text-neutral-700" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-neutral-900">
              {unlockedCount} de {doors.length || 4} destrancadas
            </span>
            <span className="text-xs text-neutral-500">
              Auto-trava: {(statusData?.unlockDurationMs || 5000) / 1000}s
            </span>
          </div>
        </div>

        <div
          className={`border rounded p-4 ${
            sensor?.alert
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-white border-neutral-200 text-neutral-900'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase">
            <span className={sensor?.alert ? 'text-red-800' : 'text-neutral-500'}>
              Monitoramento de Violação
            </span>
            <ShieldAlert className={`w-4 h-4 ${sensor?.alert ? 'text-red-700' : 'text-neutral-700'}`} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">
              {sensor?.alert ? 'VIOLAÇÃO DETECTADA!' : 'Normal (Sem alertas)'}
            </span>
            {sensor?.alert && (
              <button
                type="button"
                disabled={isAckLoading}
                onClick={handleAckSensorAlert}
                className="px-2.5 py-1 rounded bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer border-0"
              >
                {isAckLoading ? 'Limpando...' : 'Reconhecer'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mensagem de retorno da última operação de destrancamento no ESP32 */}
      {feedback && (
        <div
          className={`p-3.5 rounded border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline bg-transparent border-0 cursor-pointer text-current opacity-75 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Lista das 4 Portas Industriais */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 m-0">
            Portas da Instalação Industrial
          </h2>
          <span className="text-xs text-neutral-500">
            Atualização automática a cada 2 segundos
          </span>
        </div>

        <DoorTable
          doors={doors}
          mode="dashboard"
          userPermissions={user.permissions || []}
          isAdmin={Boolean(user.isAdmin)}
          unlockingDoorId={unlockingDoorId}
          isConnected={isConnected}
          onUnlockClick={handleUnlockDoor}
        />
      </div>
    </div>
  );
}

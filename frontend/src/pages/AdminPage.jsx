import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Cpu,
  Edit3,
  Info,
  LayoutDashboard,
  Lock,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DoorTable from '../components/DoorTable';
import UserForm from '../components/UserForm';
import ActivityLog from '../components/ActivityLog';
import {
  acknowledgeSensorAlert,
  createUser,
  deleteUser,
  fetchActivityLogs,
  fetchUsers,
  requestDoorAccess,
  subscribeApiConfig,
  updateUser,
} from '../services/api';

const DOOR_SHORT_NAMES = ['P01 Estoque', 'P02 Admin', 'P03 Produção', 'P04 Lab'];

export default function AdminPage({
  statusData,
  isConnected,
  onActionCompleted,
}) {
  const { user, accessCode, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'logs'
  const [usersList, setUsersList] = useState([]);
  const [ramNotice, setRamNotice] = useState(
    'Alterações ficam somente em memória RAM e são restauradas ao reiniciar o ESP32.'
  );
  const [logsList, setLogsList] = useState([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [authDeniedError, setAuthDeniedError] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Estado para formulário de criação/edição e modal de confirmação de exclusão
  const [editingUser, setEditingUser] = useState(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Estado para destrancamento rápido na Visão Geral
  const [unlockingDoorId, setUnlockingDoorId] = useState(null);

  const loadAdminData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoadingData(true);
      }

      try {
        const [usersRes, logsRes] = await Promise.all([
          fetchUsers(accessCode),
          fetchActivityLogs(accessCode),
        ]);

        setUsersList(usersRes.users || []);
        if (usersRes.ramOnlyNotice) {
          setRamNotice(usersRes.ramOnlyNotice);
        }
        setLogsList(logsRes.logs || []);
        setAuthDeniedError('');
      } catch (error) {
        if (error.status === 403 || error.reason === 'ADMIN_REQUIRED') {
          setAuthDeniedError(
            error.message ||
              'Acesso negado pelo ESP32. Código de administrador inválido ou ausente.'
          );
        } else if (!silent) {
          setFeedback({
            type: 'error',
            message: error.message || 'Falha ao carregar dados administrativos do ESP32.',
          });
        }
      } finally {
        if (!silent) {
          setIsLoadingData(false);
        }
      }
    },
    [accessCode]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAdminData(false);

    const intervalId = setInterval(() => {
      loadAdminData(true);
    }, 4000);

    const unsubscribe = subscribeApiConfig(() => {
      setFeedback(null);
      loadAdminData(false);
    });

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [isAuthenticated, isConnected, loadAdminData]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Se o ESP32 negar a requisição administrativa (ex: usuário comum tentando acessar /admin)
  if (authDeniedError) {
    return (
      <div className="max-w-lg mx-auto mt-6 bg-white border border-red-300 rounded p-6 text-center space-y-4">
        <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-neutral-900 m-0">
            Acesso Administrativo Negado pelo ESP32
          </h1>
          <p className="text-xs text-red-800 font-medium mt-1.5 mb-0">
            {authDeniedError}
          </p>
          <p className="text-xs text-neutral-500 mt-1 mb-0">
            Usuário atual: <strong>{user?.name}</strong> ({user?.role}). Somente usuários com cargo de Administrador no ESP32 podem consultar ou alterar configurações.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-neutral-900 text-white text-xs font-semibold no-underline hover:bg-neutral-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Painel do Usuário
          </Link>
        </div>
      </div>
    );
  }

  const doors = statusData?.doors || [];
  const sensor = statusData?.sensor || null;
  const unlockedCount = doors.filter((d) => d.unlocked).length;

  async function handleSaveUser(formData) {
    setIsSubmittingUser(true);
    setFeedback(null);

    try {
      if (formData.id) {
        const res = await updateUser({
          adminCode: accessCode,
          id: formData.id,
          name: formData.name,
          code: formData.code,
          role: formData.role,
          permissions: formData.permissions,
        });
        setFeedback({
          type: 'success',
          message: res.message || 'Usuário atualizado com sucesso.',
        });
        setEditingUser(null);
      } else {
        const res = await createUser({
          adminCode: accessCode,
          name: formData.name,
          code: formData.code,
          role: formData.role,
          permissions: formData.permissions,
        });
        setFeedback({
          type: 'success',
          message: res.message || 'Usuário cadastrado com sucesso.',
        });
      }

      await loadAdminData(true);
      return true;
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'O ESP32 recusou a operação de usuário.',
      });
      return false;
    } finally {
      setIsSubmittingUser(false);
    }
  }

  async function handleConfirmDeleteUser() {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setFeedback(null);

    try {
      const res = await deleteUser({
        adminCode: accessCode,
        id: userToDelete.id,
      });

      setFeedback({
        type: 'success',
        message: res.message || `Usuário '${userToDelete.name}' excluído com sucesso.`,
      });

      if (editingUser?.id === userToDelete.id) {
        setEditingUser(null);
      }
      setUserToDelete(null);
      await loadAdminData(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'Não foi possível excluir o usuário no ESP32.',
      });
      setUserToDelete(null);
    } finally {
      setIsDeletingUser(false);
    }
  }

  async function handleUnlockDoorFromAdmin(door) {
    setUnlockingDoorId(door.id);
    setFeedback(null);

    try {
      const res = await requestDoorAccess({
        code: accessCode,
        doorId: door.id,
        mode: 'panel',
      });
      setFeedback({
        type: 'success',
        message: `${door.name}: ${res.message || 'Acesso autorizado. Porta destrancada.'}`,
      });
      if (onActionCompleted) {
        onActionCompleted();
      }
      await loadAdminData(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: `${door.name}: ${error.message || 'Falha ao destrancar porta.'}`,
      });
      await loadAdminData(true);
    } finally {
      setUnlockingDoorId(null);
    }
  }

  async function handleAckSensor() {
    try {
      await acknowledgeSensorAlert();
      if (onActionCompleted) {
        onActionCompleted();
      }
      await loadAdminData(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'Erro ao reconhecer alerta do sensor.',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Painel Administrativo */}
      <div className="bg-white border border-neutral-200 rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded bg-neutral-900 text-white flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-neutral-900 m-0">
                Painel Administrativo OpenCargo
              </h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-neutral-100 border border-neutral-300 text-neutral-800">
                Admin: {user?.name}
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-1 mb-0">
              Gerenciamento de usuários, permissões de portas e auditoria de logs diretamente na memória RAM do ESP32.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadAdminData(false)}
            disabled={isLoadingData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 disabled:opacity-50 text-xs font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
            Sincronizar ESP32
          </button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium no-underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Painel do Usuário
          </Link>
        </div>
      </div>

      {/* Navegação por Abas Administrativas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold border cursor-pointer transition-colors ${
            activeTab === 'overview'
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Visão geral
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold border cursor-pointer transition-colors ${
            activeTab === 'users'
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Usuários ({usersList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold border cursor-pointer transition-colors ${
            activeTab === 'logs'
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Histórico de atividades ({logsList.length})
        </button>
      </div>

      {/* Mensagem de Feedback das Operações Administrativas */}
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

      {/* ==================================================================== */}
      {/* ABA 1: VISÃO GERAL                                                   */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 rounded p-4">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold uppercase">
                <span>Usuários Cadastrados</span>
                <Users className="w-4 h-4 text-neutral-700" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xl font-bold text-neutral-900">
                  {usersList.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className="text-xs font-semibold text-neutral-900 underline bg-transparent border-0 cursor-pointer p-0"
                >
                  Gerenciar usuários →
                </button>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded p-4">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold uppercase">
                <span>Estado das 4 Portas</span>
                <Cpu className="w-4 h-4 text-neutral-700" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-base font-bold text-neutral-900">
                  {unlockedCount} destrancada(s) / {doors.length - unlockedCount} trancada(s)
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
                  Sensor de Porta (GPIO {sensor?.pin ?? 33})
                </span>
                <Radio className={`w-4 h-4 ${sensor?.alert ? 'text-red-700' : 'text-neutral-700'}`} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {sensor?.state || 'FECHADA'}{' '}
                  {sensor?.alert ? '— VIOLAÇÃO!' : '(Normal)'}
                </span>
                {sensor?.alert && (
                  <button
                    type="button"
                    onClick={handleAckSensor}
                    className="px-2.5 py-1 rounded bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer border-0"
                  >
                    Reconhecer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Estado e Controle das Quatro Portas */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 m-0">
                Estado das Quatro Portas Industriais
              </h2>
              <span className="text-xs text-neutral-500">
                Acesso total de Administrador
              </span>
            </div>
            <DoorTable
              doors={doors}
              mode="dashboard"
              userPermissions={[true, true, true, true]}
              isAdmin={true}
              unlockingDoorId={unlockingDoorId}
              isConnected={isConnected}
              onUnlockClick={handleUnlockDoorFromAdmin}
            />
          </div>

          {/* Últimas Atividades */}
          <div className="space-y-2.5">
            <ActivityLog
              logs={logsList.slice(0, 6)}
              isLoading={isLoadingData}
              onRefresh={() => loadAdminData(false)}
              compact={true}
            />
            <div className="text-right">
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className="text-xs font-semibold text-neutral-900 underline bg-transparent border-0 cursor-pointer"
              >
                Ver histórico completo ({logsList.length} registros) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: GERENCIAMENTO DE USUÁRIOS                                     */}
      {/* ==================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Observação discreta sobre armazenamento em memória RAM */}
          <div className="p-3 rounded bg-neutral-100 border border-neutral-300 text-xs text-neutral-700 flex items-center gap-2">
            <Info className="w-4 h-4 text-neutral-600 shrink-0" />
            <span>
              <strong>Armazenamento em RAM:</strong> {ramNotice}
            </span>
          </div>

          {/* Formulário de Criação / Edição */}
          <UserForm
            editingUser={editingUser}
            isSubmitting={isSubmittingUser}
            onSubmitUser={handleSaveUser}
            onCancelEdit={() => setEditingUser(null)}
          />

          {/* Tabela de Usuários Cadastrados */}
          <div className="bg-white border border-neutral-200 rounded overflow-hidden">
            <div className="px-4 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 m-0">
                Usuários Cadastrados no ESP32 ({usersList.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold uppercase tracking-wider text-neutral-600">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Código de Acesso</th>
                    <th className="py-3 px-4">Cargo</th>
                    <th className="py-3 px-4">Permissões de Acesso</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {usersList.map((u) => {
                    const perms = Array.isArray(u.permissions)
                      ? u.permissions
                      : [false, false, false, false];

                    return (
                      <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-neutral-900 text-sm">
                              {u.name}
                            </span>
                            {u.isProtected && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-semibold uppercase">
                                <Lock className="w-2.5 h-2.5" />
                                Admin Principal
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500">ID #{u.id}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-1 rounded bg-neutral-100 border border-neutral-300 font-mono font-semibold text-neutral-900">
                            {u.code}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-1 rounded bg-white border border-neutral-300 font-semibold text-neutral-800">
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {DOOR_SHORT_NAMES.map((doorLabel, idx) => {
                              const allowed = Boolean(u.isAdmin || perms[idx]);
                              return (
                                <span
                                  key={doorLabel}
                                  className={`px-2 py-0.5 rounded border text-[11px] font-medium ${
                                    allowed
                                      ? 'bg-neutral-900 text-white border-neutral-900'
                                      : 'bg-neutral-100 text-neutral-400 border-neutral-200 line-through'
                                  }`}
                                >
                                  {doorLabel}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-neutral-300 bg-white text-red-700 hover:bg-red-50 hover:border-red-300 text-xs font-medium cursor-pointer"
                              title={
                                u.isProtected
                                  ? 'Administrador principal protegido pelo ESP32'
                                  : `Excluir ${u.name}`
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: HISTÓRICO DE ATIVIDADES                                       */}
      {/* ==================================================================== */}
      {activeTab === 'logs' && (
        <ActivityLog
          logs={logsList}
          isLoading={isLoadingData}
          onRefresh={() => loadAdminData(false)}
          compact={false}
        />
      )}

      {/* Modal de Confirmação de Exclusão de Usuário */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-neutral-300 rounded w-full max-w-md p-5 shadow-lg space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 m-0">
                  Confirmar Exclusão de Usuário
                </h3>
                <p className="text-xs text-neutral-600 mt-1 mb-0 leading-relaxed">
                  Deseja realmente solicitar ao ESP32 a exclusão do usuário{' '}
                  <strong>{userToDelete.name}</strong> ({userToDelete.role}, código{' '}
                  <code>{userToDelete.code}</code>)?
                </p>
                {userToDelete.isProtected && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2 mb-0">
                    Nota: Este é o administrador principal. O firmware do ESP32 validará a proteção contra exclusão.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded border-0 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 text-xs font-semibold cursor-pointer"
              >
                {isDeletingUser ? 'Excluindo no ESP32...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

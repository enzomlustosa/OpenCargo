import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  XCircle,
} from 'lucide-react';

const EVENT_TYPE_LABELS = {
  ALL: 'Todos os eventos',
  LOGIN: 'Logins',
  ACESSO: 'Acessos às portas',
  SENSOR: 'Sensor / Violação',
  TRAVAMENTO_AUTO: 'Travamentos automáticos',
  ADMIN: 'Alterações administrativas',
  SISTEMA: 'Sistema',
};

function getResultBadge(result) {
  switch (result) {
    case 'AUTORIZADO':
      return {
        icon: CheckCircle2,
        className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        label: 'AUTORIZADO',
      };
    case 'NEGADO':
      return {
        icon: XCircle,
        className: 'bg-red-50 text-red-800 border-red-300',
        label: 'NEGADO',
      };
    case 'ALERTA':
      return {
        icon: AlertTriangle,
        className: 'bg-amber-50 text-amber-900 border-amber-300',
        label: 'ALERTA',
      };
    default:
      return {
        icon: Info,
        className: 'bg-neutral-100 text-neutral-800 border-neutral-300',
        label: result || 'INFO',
      };
  }
}

export default function ActivityLog({
  logs = [],
  isLoading = false,
  onRefresh,
  compact = false,
}) {
  const [filterType, setFilterType] = useState('ALL');

  const filteredLogs =
    filterType === 'ALL'
      ? logs
      : logs.filter((entry) => entry.eventType === filterType);

  return (
    <div className="bg-white border border-neutral-200 rounded overflow-hidden">
      {/* Cabeçalho da Tabela de Histórico */}
      <div className="px-4 py-3.5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-800" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 m-0">
              {compact ? 'Últimas Atividades Registradas' : 'Histórico de Atividades (Memória RAM do ESP32)'}
            </h3>
          </div>
          {!compact && (
            <p className="text-xs text-neutral-500 mt-0.5 mb-0">
              Horário relativo ao tempo de execução do ESP32 (<code>millis()</code> — limite de 50 eventos recentes). Códigos parcialmente ocultos por segurança.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!compact && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filtrar por tipo de atividade"
              className="px-2.5 py-1.5 rounded border border-neutral-300 bg-white text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 disabled:opacity-50 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar registros
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Eventos */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center text-xs text-neutral-500">
          Nenhum registro encontrado no histórico do ESP32.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold uppercase tracking-wider text-neutral-600">
                <th className="py-2.5 px-4">Horário (Uptime)</th>
                <th className="py-2.5 px-4">Usuário / Código</th>
                <th className="py-2.5 px-4">Tipo de Atividade</th>
                <th className="py-2.5 px-4">Porta Relacionada</th>
                <th className="py-2.5 px-4">Resultado / Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredLogs.map((entry) => {
                const badge = getResultBadge(entry.result);
                const BadgeIcon = badge.icon;

                return (
                  <tr key={entry.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-neutral-700">
                      <span className="font-semibold text-neutral-900">#{entry.id}</span>{' '}
                      <span>{entry.relativeTime || '00:00:00'}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900">
                        {entry.userName || 'Desconhecido'}
                      </div>
                      <div className="font-mono text-[11px] text-neutral-500">
                        Código: {entry.maskedCode || 'Código desconhecido'}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 font-mono text-[11px] font-semibold text-neutral-800">
                        {entry.eventType}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-neutral-800 font-medium">
                      {entry.doorName && entry.doorName !== '-' ? entry.doorName : '—'}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold w-fit shrink-0 ${badge.className}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                        <span className="text-neutral-700">{entry.reason}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

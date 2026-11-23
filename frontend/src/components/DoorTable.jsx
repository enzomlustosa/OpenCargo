import React from 'react';
import { Lock, Unlock, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function DoorTable({
  doors = [],
  mode = 'dashboard', // 'dashboard' | 'single'
  userPermissions = [],
  isAdmin = false,
  unlockingDoorId = null,
  isConnected = true,
  onUnlockClick,
}) {
  if (!doors || doors.length === 0) {
    return (
      <div className="border border-neutral-200 rounded bg-white p-8 text-center text-sm text-neutral-500">
        Nenhuma porta carregada. Verifique a conexão com o ESP32.
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              <th className="py-3 px-4">Porta / Setor</th>
              <th className="py-3 px-4">Atuador (ESP32)</th>
              <th className="py-3 px-4">Estado Atual</th>
              {mode === 'dashboard' && <th className="py-3 px-4">Permissão</th>}
              <th className="py-3 px-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {doors.map((door, index) => {
              // No modo dashboard, exibe visualmente a permissão informada pelo ESP32 no login,
              // mas a decisão real ocorre novamente no ESP32 ao clicar em "Destrancar".
              const hasPermission =
                mode === 'single' ? true : Boolean(isAdmin || userPermissions[index]);
              const isUnlocking = unlockingDoorId === door.id;
              const remainingSeconds = door.remainingMs
                ? Math.ceil(door.remainingMs / 1000)
                : 0;

              return (
                <tr key={door.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-neutral-900">{door.name}</div>
                    <div className="text-xs text-neutral-500">Identificador: Porta #{door.id}</div>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-xs text-neutral-600">
                    LED GPIO {door.pin}
                  </td>

                  <td className="py-3.5 px-4">
                    {door.unlocked ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                        Destrancada
                        {remainingSeconds > 0 && (
                          <span className="font-mono text-[11px]">({remainingSeconds}s)</span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-300">
                        <Lock className="w-3.5 h-3.5 text-neutral-600" />
                        Trancada
                      </span>
                    )}
                  </td>

                  {mode === 'dashboard' && (
                    <td className="py-3.5 px-4">
                      {hasPermission ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          Autorizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
                          <ShieldAlert className="w-3.5 h-3.5 text-neutral-400" />
                          Sem permissão
                        </span>
                      )}
                    </td>
                  )}

                  <td className="py-3.5 px-4 text-right">
                    {mode === 'dashboard' && !hasPermission ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center px-3.5 py-1.5 rounded text-xs font-medium bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                      >
                        Sem permissão
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!isConnected || isUnlocking}
                        onClick={() => onUnlockClick(door)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed cursor-pointer border-0 transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        {isUnlocking
                          ? 'Validando...'
                          : door.unlocked
                          ? 'Destrancar novamente'
                          : 'Destrancar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, Unlock, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AccessCodeModal({
  door,
  isOpen,
  isSubmitting,
  feedback,
  onClose,
  onSubmitCode,
}) {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCode('');
    }
  }, [isOpen, door]);

  if (!isOpen || !door) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmitCode(code);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white border border-neutral-300 rounded w-full max-w-md shadow-lg overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-neutral-900" />
            <h2 id="modal-title" className="text-base font-bold text-neutral-900 m-0">
              Acesso avulso — Solicitar Destrancamento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer border-0 bg-transparent"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded bg-neutral-50 border border-neutral-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-500 uppercase font-semibold">Porta selecionada</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">{door.name}</div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-white border border-neutral-300 text-neutral-700">
              {door.unlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              GPIO {door.pin}
            </span>
          </div>

          <div>
            <label
              htmlFor="single-access-code"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              Código de acesso
            </label>
            <input
              id="single-access-code"
              type="password"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Informe seu código (ex: 12345)"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded border border-neutral-300 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 box-border"
            />
            <p className="text-xs text-neutral-500 mt-1.5 mb-0">
              O código e a porta solicitada serão validados diretamente pelo ESP32.
            </p>
          </div>

          {/* Resultado da validação retornado pelo ESP32 */}
          {feedback && (
            <div
              className={`p-3.5 rounded border text-xs flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                <div className="font-semibold">{feedback.message}</div>
                {feedback.detail && <div className="mt-0.5 opacity-90">{feedback.detail}</div>}
              </div>
            </div>
          )}

          {/* Botões do Modal */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !code.trim()}
              className="px-4 py-2 rounded border-0 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
            >
              {isSubmitting ? 'Validando no ESP32...' : 'Confirmar e Destrancar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

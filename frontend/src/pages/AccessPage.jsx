import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Radio, ShieldAlert } from 'lucide-react';
import DoorTable from '../components/DoorTable';
import AccessCodeModal from '../components/AccessCodeModal';
import { requestDoorAccess } from '../services/api';

export default function AccessPage({
  statusData,
  isConnected,
  onActionCompleted,
}) {
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  const doors = statusData?.doors || [];
  const sensor = statusData?.sensor || null;

  function handleOpenModal(door) {
    setSelectedDoor(door);
    setModalFeedback(null);
  }

  function handleCloseModal() {
    if (isSubmitting) return;
    setSelectedDoor(null);
    setModalFeedback(null);
  }

  async function handleSubmitSingleAccess(code) {
    if (!selectedDoor) return;

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      const response = await requestDoorAccess({
        code,
        doorId: selectedDoor.id,
        mode: 'single',
      });

      setModalFeedback({
        type: 'success',
        message: response.message || 'Acesso autorizado. Porta destrancada.',
        detail: response.user
          ? `Autorizado para ${response.user.name} (${response.user.role}). Travamento automático em ${(response.unlockDurationMs || 5000) / 1000}s.`
          : null,
      });

      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      setModalFeedback({
        type: 'error',
        message: error.message || 'Não foi possível autorizar o acesso.',
      });
      if (onActionCompleted) {
        onActionCompleted();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página de Acesso Avulso */}
      <div className="bg-white border border-neutral-200 rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-700 mb-2">
            <KeyRound className="w-3.5 h-3.5" />
            Modo sem sessão ativa
          </div>
          <h1 className="text-xl font-bold text-neutral-900 m-0">
            Acesso avulso às Portas Industriais
          </h1>
          <p className="text-xs text-neutral-600 mt-1 mb-0">
            Selecione qualquer porta abaixo e informe seu código de acesso no modal. O ESP32 validará sua permissão e registrará a tentativa no histórico.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium no-underline shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Login
        </Link>
      </div>

      {/* Resumo rápido do sensor físico */}
      {sensor && (
        <div
          className={`border rounded p-4 flex flex-wrap items-center justify-between gap-3 text-xs ${
            sensor.alert
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-white border-neutral-200 text-neutral-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {sensor.alert ? (
              <ShieldAlert className="w-4 h-4 text-red-700" />
            ) : (
              <Radio className="w-4 h-4 text-neutral-600" />
            )}
            <span>
              <strong>Sensor Físico de Porta (GPIO {sensor.pin}):</strong>{' '}
              {sensor.state === 'ABERTA' ? 'PORTA FÍSICA ABERTA (ACIONADO)' : 'FECHADA (NORMAL)'}
            </span>
          </div>
          {sensor.alert && (
            <span className="font-semibold text-red-800">
              Alerta ativo: Abertura física não autorizada detectada!
            </span>
          )}
        </div>
      )}

      {/* Tabela das 4 portas */}
      <DoorTable
        doors={doors}
        mode="single"
        isConnected={isConnected}
        onUnlockClick={handleOpenModal}
      />

      {/* Modal central para informar código de acesso */}
      <AccessCodeModal
        door={selectedDoor}
        isOpen={Boolean(selectedDoor)}
        isSubmitting={isSubmitting}
        feedback={modalFeedback}
        onClose={handleCloseModal}
        onSubmitCode={handleSubmitSingleAccess}
      />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Cpu, Power, Radio, RefreshCw, Settings2, Wifi, WifiOff } from 'lucide-react';
import {
  getApiConfig,
  setApiMode,
  setEsp32BaseUrl,
  simulateEsp32Restart,
  simulatePhysicalSensorToggle,
  subscribeApiConfig,
} from '../services/api';

export default function StatusIndicator({
  statusData,
  isConnected,
  isChecking,
  onRetry,
}) {
  const [apiConfig, setApiConfigState] = useState(getApiConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(apiConfig.baseUrl);

  useEffect(() => {
    return subscribeApiConfig((newConfig) => {
      setApiConfigState(newConfig);
      setUrlInput(newConfig.baseUrl);
    });
  }, []);

  function handleModeChange(newMode) {
    setApiMode(newMode);
    if (onRetry) {
      setTimeout(() => onRetry(), 20);
    }
  }

  function handleSaveUrl(e) {
    e.preventDefault();
    setEsp32BaseUrl(urlInput);
    setShowSettings(false);
    if (onRetry) {
      setTimeout(() => onRetry(), 20);
    }
  }

  function handleToggleSimSensor() {
    simulatePhysicalSensorToggle();
    if (onRetry) {
      onRetry();
    }
  }

  function handleSimulateReboot() {
    simulateEsp32Restart();
    if (onRetry) {
      onRetry();
    }
  }

  const isSimulator = apiConfig.mode === 'simulator';

  return (
    <div className="border-b border-neutral-200 bg-neutral-100/80 text-xs text-neutral-700">
      <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Indicador explícito do Modo da API e Status de Conexão */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold border ${
              isSimulator
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-900 border-neutral-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            {isSimulator ? 'MODO: SIMULADOR LOCAL (API ESP32)' : `MODO: ESP32 REAL (${apiConfig.baseUrl})`}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium border ${
              isConnected
                ? 'bg-white text-emerald-800 border-emerald-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {isSimulator ? 'Simulador Ativo' : `ESP32 Conectado (${statusData?.ip || 'HTTP'})`}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-600" />
                <span>ESP32 desconectado</span>
              </>
            )}
          </span>

          {isConnected && statusData?.relativeTime && (
            <span className="hidden sm:inline-block text-neutral-500">
              Uptime: <strong className="text-neutral-700 font-mono">{statusData.relativeTime}</strong>
            </span>
          )}
        </div>

        {/* Controles rápidos de conexão e simulação de hardware */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isSimulator && (
            <>
              <button
                type="button"
                onClick={handleToggleSimSensor}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 cursor-pointer text-xs font-medium"
                title="Simula o pressionamento do botão físico de sensor (GPIO 33) no circuito"
              >
                <Radio className="w-3.5 h-3.5" />
                Sensor GPIO 33: <strong>{statusData?.sensor?.state || 'FECHADA'}</strong> (Alternar)
              </button>

              <button
                type="button"
                onClick={handleSimulateReboot}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 cursor-pointer text-xs font-medium"
                title="Simula o reinício (reboot) do ESP32, restaurando os 4 usuários iniciais e limpando a RAM"
              >
                <Power className="w-3.5 h-3.5" />
                Reiniciar ESP32 (RAM)
              </button>
            </>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isChecking}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 cursor-pointer text-xs font-medium"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Conexão
          </button>
        </div>
      </div>

      {/* Painel expansível para alternar entre ESP32 Real e Simulador Local ou configurar IP */}
      {showSettings && (
        <div className="border-t border-neutral-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-700">Fonte da API:</span>
              <button
                type="button"
                onClick={() => handleModeChange('esp32')}
                className={`px-3 py-1.5 rounded text-xs font-medium border cursor-pointer ${
                  !isSimulator
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                ESP32 Real (HTTP)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('simulator')}
                className={`px-3 py-1.5 rounded text-xs font-medium border cursor-pointer ${
                  isSimulator
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                Simulador Local (Espelho ESP32)
              </button>
            </div>

            {!isSimulator && (
              <form onSubmit={handleSaveUrl} className="flex items-center gap-2">
                <label htmlFor="esp32-url-input" className="text-neutral-600 font-medium">
                  URL do ESP32:
                </label>
                <input
                  id="esp32-url-input"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://localhost:8180"
                  className="px-2.5 py-1 rounded border border-neutral-300 text-xs font-mono text-neutral-900 w-52 focus:outline-none focus:border-neutral-900"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer border-0"
                >
                  Salvar
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Módulo Central de Comunicação HTTP com o ESP32 (e Simulador Local da API)
// ============================================================================
// Importante: Componentes React NUNCA decidem autenticação ou autorização.
// Toda decisão vem da resposta JSON da API (ESP32 Real ou Simulador da API).

const DEFAULT_BASE_URL = (import.meta.env.VITE_ESP32_BASE_URL || 'http://localhost:8180').replace(/\/+$/, '');
const STORAGE_MODE_KEY = 'opencargo_api_mode';
const STORAGE_URL_KEY = 'opencargo_esp32_url';

const DOOR_UNLOCK_DURATION_MS = 5000;
const MAX_USERS = 16;
const MAX_LOGS = 50;
const VALID_ROLES = ['Funcionário', 'Supervisor', 'Gerente', 'Administrador'];

let currentApiMode = localStorage.getItem(STORAGE_MODE_KEY) || 'esp32'; // 'esp32' | 'simulator'
let currentBaseUrl = localStorage.getItem(STORAGE_URL_KEY) || DEFAULT_BASE_URL;
const modeListeners = new Set();

export function getApiConfig() {
  return {
    mode: currentApiMode,
    baseUrl: currentBaseUrl,
  };
}

export function setApiMode(newMode) {
  if (newMode !== 'esp32' && newMode !== 'simulator') return;
  currentApiMode = newMode;
  localStorage.setItem(STORAGE_MODE_KEY, newMode);
  notifyConfigListeners();
}

export function setEsp32BaseUrl(newUrl) {
  const cleaned = (newUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  currentBaseUrl = cleaned || DEFAULT_BASE_URL;
  localStorage.setItem(STORAGE_URL_KEY, currentBaseUrl);
  notifyConfigListeners();
}

export function subscribeApiConfig(listener) {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

function notifyConfigListeners() {
  const snapshot = getApiConfig();
  modeListeners.forEach((fn) => fn(snapshot));
}

// ============================================================================
// Estado Interno do Simulador Local da API do ESP32 (Espelho Fiel do sketch.ino)
// ============================================================================
let simStartTimeMs = Date.now();

function createInitialUsers() {
  return [
    { id: 1, name: 'Ana Souza', code: '12345', role: 'Funcionário', permissions: [true, false, true, false], isProtected: false },
    { id: 2, name: 'Bruno Lima', code: '23456', role: 'Supervisor', permissions: [true, true, true, false], isProtected: false },
    { id: 3, name: 'Carla Mendes', code: '34567', role: 'Gerente', permissions: [true, true, true, true], isProtected: false },
    { id: 4, name: 'Admin', code: '00000', role: 'Administrador', permissions: [true, true, true, true], isProtected: true },
  ];
}

function createInitialDoors() {
  return [
    { id: 1, name: 'Porta 01 - Estoque', pin: 25, unlocked: false, unlockedAtMs: 0 },
    { id: 2, name: 'Porta 02 - Administração', pin: 26, unlocked: false, unlockedAtMs: 0 },
    { id: 3, name: 'Porta 03 - Produção', pin: 27, unlocked: false, unlockedAtMs: 0 },
    { id: 4, name: 'Porta 04 - Laboratório', pin: 14, unlocked: false, unlockedAtMs: 0 },
  ];
}

const simState = {
  sensor: {
    pin: 33,
    triggered: false,
    state: 'FECHADA',
    alert: false,
  },
  doors: createInitialDoors(),
  users: createInitialUsers(),
  nextUserId: 5,
  logs: [],
  nextLogId: 1,
};

function simGetUptimeMs() {
  return Date.now() - simStartTimeMs;
}

function simFormatRelativeTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function simMaskCode(code, userFound = true) {
  if (!code) return 'Código desconhecido';
  const suffix = code.length >= 2 ? code.slice(-2) : code;
  return userFound ? `***${suffix}` : `***${suffix} (Desconhecido)`;
}

function simAddLog(eventType, userName, maskedCode, doorId, doorName, result, reason) {
  const timestampMs = simGetUptimeMs();
  const entry = {
    id: simState.nextLogId++,
    timestampMs,
    relativeTime: simFormatRelativeTime(timestampMs),
    eventType,
    userName,
    maskedCode,
    doorId,
    doorName,
    result,
    reason,
  };
  simState.logs.push(entry);
  if (simState.logs.length > MAX_LOGS) {
    simState.logs.shift();
  }
}

// Log inicial idêntico ao setup() do sketch.ino
simAddLog(
  'SISTEMA',
  'Sistema',
  'N/A',
  0,
  '-',
  'INFO',
  'Sistema iniciado com 4 usuários padrão carregados em RAM.'
);

// Permite simular o reinício (reboot) do ESP32, limpando dados voláteis em RAM
export function simulateEsp32Restart() {
  simStartTimeMs = Date.now();
  simState.sensor = {
    pin: 33,
    triggered: false,
    state: 'FECHADA',
    alert: false,
  };
  simState.doors = createInitialDoors();
  simState.users = createInitialUsers();
  simState.nextUserId = 5;
  simState.logs = [];
  simState.nextLogId = 1;

  simAddLog(
    'SISTEMA',
    'Sistema',
    'N/A',
    0,
    '-',
    'INFO',
    'Sistema iniciado com 4 usuários padrão carregados em RAM.'
  );
  notifyConfigListeners();
}

function simUpdateAutoLocks() {
  const now = simGetUptimeMs();
  simState.doors.forEach((door) => {
    if (door.unlocked && door.unlockedAtMs > 0) {
      if (now - door.unlockedAtMs >= DOOR_UNLOCK_DURATION_MS) {
        door.unlocked = false;
        door.unlockedAtMs = 0;
        simAddLog(
          'TRAVAMENTO_AUTO',
          'Sistema',
          'N/A',
          door.id,
          door.name,
          'INFO',
          'Porta trancada automaticamente após tempo limite.'
        );
      }
    }
  });
}

function simNormalizeRole(role) {
  if (role === 'Funcionario') return 'Funcionário';
  return role;
}

function simBuildPublicUser(user) {
  const isAdmin = user.role.toLowerCase() === 'administrador';
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    isAdmin,
    isProtected: Boolean(user.isProtected),
    permissions: isAdmin ? [true, true, true, true] : [...user.permissions],
  };
}

function simBuildAdminUser(user) {
  const isAdmin = user.role.toLowerCase() === 'administrador';
  return {
    id: user.id,
    name: user.name,
    code: user.code,
    maskedCode: simMaskCode(user.code, true),
    role: user.role,
    isAdmin,
    isProtected: Boolean(user.isProtected),
    permissions: isAdmin ? [true, true, true, true] : [...user.permissions],
  };
}

// Permite simular o clique no botão físico do sensor (GPIO 33) quando no modo Simulador Local
export function simulatePhysicalSensorToggle() {
  simUpdateAutoLocks();
  const nextTriggered = !simState.sensor.triggered;
  simState.sensor.triggered = nextTriggered;
  simState.sensor.state = nextTriggered ? 'ABERTA' : 'FECHADA';

  if (nextTriggered) {
    const anyUnlocked = simState.doors.some((d) => d.unlocked);
    if (!anyUnlocked) {
      simState.sensor.alert = true;
      simAddLog(
        'SENSOR',
        'Sensor Físico',
        'N/A',
        0,
        'Sensor de Porta (GPIO 33)',
        'ALERTA',
        'Abertura física não autorizada detectada com portas trancadas!'
      );
    } else {
      simAddLog(
        'SENSOR',
        'Sensor Físico',
        'N/A',
        0,
        'Sensor de Porta (GPIO 33)',
        'INFO',
        'Abertura física detectada durante destrancamento autorizado.'
      );
    }
  } else {
    simAddLog(
      'SENSOR',
      'Sensor Físico',
      'N/A',
      0,
      'Sensor de Porta (GPIO 33)',
      'INFO',
      'Sensor físico retornou ao estado fechado.'
    );
  }
}

// Processador interno de requisições do Simulador Local (replica exatamente o WebServer do ESP32)
async function handleSimulatedRequest(method, path, body = null) {
  await new Promise((resolve) => setTimeout(resolve, 80));
  simUpdateAutoLocks();

  const urlObj = new URL(path, 'http://10.10.0.2');
  const pathname = urlObj.pathname;

  // GET /api/status
  if (method === 'GET' && pathname === '/api/status') {
    const now = simGetUptimeMs();
    return {
      status: 200,
      data: {
        system: 'OpenCargo',
        stage: 3,
        online: true,
        uptimeMs: now,
        relativeTime: simFormatRelativeTime(now),
        ip: '10.10.0.2 (Simulador Local)',
        unlockDurationMs: DOOR_UNLOCK_DURATION_MS,
        sensor: { ...simState.sensor },
        doors: simState.doors.map((d) => {
          const remainingMs =
            d.unlocked && d.unlockedAtMs > 0
              ? Math.max(0, DOOR_UNLOCK_DURATION_MS - (now - d.unlockedAtMs))
              : 0;
          return {
            id: d.id,
            name: d.name,
            pin: d.pin,
            unlocked: d.unlocked,
            remainingMs,
          };
        }),
      },
    };
  }

  // POST /api/login
  if (method === 'POST' && pathname === '/api/login') {
    const code = String(body?.code || '').trim();
    if (!code) {
      return {
        status: 400,
        data: { success: false, reason: 'CODE_REQUIRED', message: 'Informe o código de acesso.' },
      };
    }

    const user = simState.users.find((u) => u.code === code);
    if (!user) {
      simAddLog('LOGIN', 'Desconhecido', simMaskCode(code, false), 0, '-', 'NEGADO', 'Tentativa de login com código inexistente.');
      return {
        status: 401,
        data: { success: false, reason: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' },
      };
    }

    simAddLog('LOGIN', user.name, simMaskCode(user.code, true), 0, '-', 'AUTORIZADO', `Login realizado (${user.role}).`);
    return {
      status: 200,
      data: {
        success: true,
        message: 'Login realizado com sucesso.',
        user: simBuildPublicUser(user),
      },
    };
  }

  // POST /api/access
  if (method === 'POST' && pathname === '/api/access') {
    const code = String(body?.code || '').trim();
    const doorId = Number(body?.doorId);
    const modeLabel = body?.mode === 'single' ? 'Acesso avulso' : 'Painel';

    const door = simState.doors.find((d) => d.id === doorId);
    if (!door) {
      return {
        status: 404,
        data: { success: false, reason: 'INVALID_DOOR', message: 'Porta inválida. Escolha uma porta entre 1 e 4.' },
      };
    }

    if (!code) {
      return {
        status: 400,
        data: { success: false, reason: 'CODE_REQUIRED', message: 'Informe o código de acesso.' },
      };
    }

    const user = simState.users.find((u) => u.code === code);
    if (!user) {
      simAddLog('ACESSO', 'Desconhecido', simMaskCode(code, false), door.id, door.name, 'NEGADO', `Código inexistente (${modeLabel}).`);
      return {
        status: 401,
        data: { success: false, reason: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' },
      };
    }

    const isAdmin = user.role.toLowerCase() === 'administrador';
    const allowed = isAdmin || Boolean(user.permissions[door.id - 1]);

    if (!allowed) {
      simAddLog('ACESSO', user.name, simMaskCode(user.code, true), door.id, door.name, 'NEGADO', `Usuário sem permissão para esta porta (${modeLabel}).`);
      return {
        status: 403,
        data: {
          success: false,
          reason: 'FORBIDDEN',
          message: 'Você não possui autorização para esta porta. A equipe de administração foi notificada.',
        },
      };
    }

    door.unlocked = true;
    door.unlockedAtMs = simGetUptimeMs();

    simAddLog(
      'ACESSO',
      user.name,
      simMaskCode(user.code, true),
      door.id,
      door.name,
      'AUTORIZADO',
      `Acesso autorizado e porta destrancada por ${DOOR_UNLOCK_DURATION_MS / 1000}s (${modeLabel}).`
    );

    return {
      status: 200,
      data: {
        success: true,
        message: 'Acesso autorizado. Porta destrancada.',
        doorId: door.id,
        doorName: door.name,
        doorUnlocked: true,
        unlockDurationMs: DOOR_UNLOCK_DURATION_MS,
        user: simBuildPublicUser(user),
      },
    };
  }

  // POST /api/sensor/ack
  if (method === 'POST' && pathname === '/api/sensor/ack') {
    simState.sensor.alert = false;
    simAddLog('SENSOR', 'Operador', 'N/A', 0, 'Sensor de Porta (GPIO 33)', 'INFO', 'Alerta de sensor reconhecido/redefinido pela interface.');
    return {
      status: 200,
      data: { success: true, message: 'Alerta do sensor redefinido.', alert: false },
    };
  }

  // ==========================================================================
  // Rotas Administrativas (/api/users, /api/users/:id e /api/logs)
  // ==========================================================================
  if (pathname.startsWith('/api/users') || pathname === '/api/logs') {
    const adminCode = String(
      urlObj.searchParams.get('adminCode') ||
        urlObj.searchParams.get('code') ||
        body?.adminCode ||
        ''
    ).trim();

    const callerUser = simState.users.find((u) => u.code === adminCode);
    const isCallerAdmin = callerUser && callerUser.role.toLowerCase() === 'administrador';

    if (!isCallerAdmin) {
      return {
        status: 403,
        data: {
          success: false,
          reason: 'ADMIN_REQUIRED',
          message: 'Acesso negado. Código de administrador inválido ou ausente.',
        },
      };
    }

    // GET /api/users
    if (method === 'GET' && pathname === '/api/users') {
      return {
        status: 200,
        data: {
          success: true,
          ramOnlyNotice: 'Alterações ficam somente em memória RAM e são restauradas ao reiniciar o ESP32.',
          users: simState.users.map(simBuildAdminUser),
        },
      };
    }

    // POST /api/users (Cadastrar novo usuário)
    if (method === 'POST' && pathname === '/api/users') {
      const name = String(body?.name || '').trim();
      const userCode = String(body?.userCode || body?.code || '').trim();
      const role = simNormalizeRole(String(body?.role || '').trim());

      if (!name || !userCode || !role) {
        return {
          status: 400,
          data: {
            success: false,
            reason: 'VALIDATION_ERROR',
            message: 'Nome, código e cargo são obrigatórios.',
          },
        };
      }

      if (!VALID_ROLES.includes(role)) {
        return {
          status: 400,
          data: {
            success: false,
            reason: 'INVALID_ROLE',
            message: 'Cargo inválido. Use Funcionário, Supervisor, Gerente ou Administrador.',
          },
        };
      }

      if (simState.users.some((u) => u.code === userCode)) {
        return {
          status: 409,
          data: {
            success: false,
            reason: 'DUPLICATE_CODE',
            message: 'Já existe um usuário com este código de acesso.',
          },
        };
      }

      if (simState.users.length >= MAX_USERS) {
        return {
          status: 507,
          data: {
            success: false,
            reason: 'USERS_FULL',
            message: 'Limite máximo de usuários em RAM atingido.',
          },
        };
      }

      const isAdmin = role.toLowerCase() === 'administrador';
      const rawPerms = Array.isArray(body?.permissions) ? body.permissions : [false, false, false, false];
      const permissions = isAdmin
        ? [true, true, true, true]
        : [Boolean(rawPerms[0]), Boolean(rawPerms[1]), Boolean(rawPerms[2]), Boolean(rawPerms[3])];

      const newUser = {
        id: simState.nextUserId++,
        name,
        code: userCode,
        role,
        permissions,
        isProtected: false,
      };

      simState.users.push(newUser);

      simAddLog(
        'ADMIN',
        callerUser.name,
        simMaskCode(callerUser.code, true),
        0,
        '-',
        'INFO',
        `Cadastrou usuário '${newUser.name}' (${newUser.role}).`
      );

      return {
        status: 201,
        data: {
          success: true,
          message: 'Usuário cadastrado com sucesso.',
          user: simBuildAdminUser(newUser),
        },
      };
    }

    // PUT /api/users ou PUT /api/users/:id (Atualizar usuário)
    if (method === 'PUT' && pathname.startsWith('/api/users')) {
      const pathParts = pathname.split('/');
      const pathId = pathParts.length >= 4 ? Number(pathParts[3]) : -1;
      const targetId = pathId > 0 ? pathId : Number(body?.id || urlObj.searchParams.get('id') || -1);

      const target = simState.users.find((u) => u.id === targetId);
      if (!target) {
        return {
          status: 404,
          data: {
            success: false,
            reason: 'USER_NOT_FOUND',
            message: 'Usuário para edição não encontrado.',
          },
        };
      }

      const name = String(body?.name ?? target.name).trim() || target.name;
      const newCode = String(body?.userCode ?? body?.code ?? target.code).trim() || target.code;
      const role = simNormalizeRole(String(body?.role ?? target.role).trim() || target.role);

      if (!VALID_ROLES.includes(role)) {
        return {
          status: 400,
          data: {
            success: false,
            reason: 'INVALID_ROLE',
            message: 'Cargo inválido.',
          },
        };
      }

      if (target.isProtected && role.toLowerCase() !== 'administrador') {
        return {
          status: 403,
          data: {
            success: false,
            reason: 'PROTECTED_ADMIN',
            message: 'O cargo do administrador principal não pode ser rebaixado.',
          },
        };
      }

      if (simState.users.some((u) => u.id !== target.id && u.code === newCode)) {
        return {
          status: 409,
          data: {
            success: false,
            reason: 'DUPLICATE_CODE',
            message: 'Já existe outro usuário utilizando este código.',
          },
        };
      }

      const isAdmin = role.toLowerCase() === 'administrador' || target.isProtected;
      const rawPerms = Array.isArray(body?.permissions) ? body.permissions : target.permissions;
      const permissions = isAdmin
        ? [true, true, true, true]
        : [Boolean(rawPerms[0]), Boolean(rawPerms[1]), Boolean(rawPerms[2]), Boolean(rawPerms[3])];

      target.name = name;
      target.code = newCode;
      target.role = role;
      target.permissions = permissions;

      simAddLog(
        'ADMIN',
        callerUser.name,
        simMaskCode(callerUser.code, true),
        0,
        '-',
        'INFO',
        `Atualizou usuário '${target.name}' (ID ${target.id}).`
      );

      return {
        status: 200,
        data: {
          success: true,
          message: 'Usuário atualizado com sucesso.',
          user: simBuildAdminUser(target),
        },
      };
    }

    // DELETE /api/users ou DELETE /api/users/:id (Excluir usuário)
    if (method === 'DELETE' && pathname.startsWith('/api/users')) {
      const pathParts = pathname.split('/');
      const pathId = pathParts.length >= 4 ? Number(pathParts[3]) : -1;
      const targetId = pathId > 0 ? pathId : Number(body?.id || urlObj.searchParams.get('id') || -1);

      const targetIndex = simState.users.findIndex((u) => u.id === targetId);
      if (targetIndex === -1) {
        return {
          status: 404,
          data: {
            success: false,
            reason: 'USER_NOT_FOUND',
            message: 'Usuário para exclusão não encontrado.',
          },
        };
      }

      const target = simState.users[targetIndex];
      if (target.isProtected) {
        return {
          status: 403,
          data: {
            success: false,
            reason: 'PROTECTED_ADMIN',
            message: 'O administrador principal não pode ser excluído.',
          },
        };
      }

      simState.users.splice(targetIndex, 1);

      simAddLog(
        'ADMIN',
        callerUser.name,
        simMaskCode(callerUser.code, true),
        0,
        '-',
        'INFO',
        `Excluiu usuário '${target.name}' (ID ${target.id}).`
      );

      return {
        status: 200,
        data: {
          success: true,
          message: 'Usuário excluído com sucesso.',
          deletedId: target.id,
        },
      };
    }

    // GET /api/logs
    if (method === 'GET' && pathname === '/api/logs') {
      return {
        status: 200,
        data: {
          success: true,
          timeReference: 'uptime_millis',
          total: simState.logs.length,
          logs: [...simState.logs].reverse(),
        },
      };
    }
  }

  return {
    status: 404,
    data: { success: false, reason: 'NOT_FOUND', message: 'Endpoint não encontrado.' },
  };
}

// ============================================================================
// Cliente HTTP Unificado
// ============================================================================
async function apiRequest(method, path, body = null) {
  if (currentApiMode === 'simulator') {
    const simResponse = await handleSimulatedRequest(method, path, body);
    if (simResponse.status >= 400) {
      const err = new Error(simResponse.data?.message || 'Erro na requisição.');
      err.status = simResponse.status;
      err.reason = simResponse.data?.reason || 'HTTP_ERROR';
      err.data = simResponse.data;
      throw err;
    }
    return simResponse.data;
  }

  // Modo ESP32 Real via HTTP
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const options = {
      method,
      headers: {},
      signal: controller.signal,
    };

    if (body !== null) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${currentBaseUrl}${path}`, options);
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      const err = new Error(data.message || `Erro HTTP ${response.status}`);
      err.status = response.status;
      err.reason = data.reason || 'HTTP_ERROR';
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.status) {
      throw error;
    }

    const netError = new Error(
      `Não foi possível conectar ao ESP32 em ${currentBaseUrl}. Verifique se o servidor HTTP do ESP32 ou o port forwarding (${currentBaseUrl}) está ativo.`
    );
    netError.isNetworkError = true;
    netError.reason = 'ESP32_DISCONNECTED';
    throw netError;
  }
}

// ============================================================================
// Funções Públicas da API Consumidas Pelas Páginas React
// ============================================================================
export function fetchSystemStatus() {
  return apiRequest('GET', '/api/status');
}

export function loginWithCode(code) {
  return apiRequest('POST', '/api/login', { code });
}

export function requestDoorAccess({ code, doorId, mode = 'panel' }) {
  return apiRequest('POST', '/api/access', { code, doorId, mode });
}

export function acknowledgeSensorAlert() {
  return apiRequest('POST', '/api/sensor/ack', {});
}

// Funções Administrativas (Validadas pelo ESP32 com adminCode)
export function fetchUsers(adminCode) {
  const query = `?adminCode=${encodeURIComponent(adminCode || '')}`;
  return apiRequest('GET', `/api/users${query}`);
}

export function createUser({ adminCode, name, code, role, permissions }) {
  return apiRequest('POST', '/api/users', {
    adminCode,
    name,
    code,
    role,
    permissions,
  });
}

export function updateUser({ adminCode, id, name, code, role, permissions }) {
  return apiRequest('PUT', `/api/users/${id}`, {
    adminCode,
    id,
    name,
    code,
    role,
    permissions,
  });
}

export function deleteUser({ adminCode, id }) {
  const query = `?adminCode=${encodeURIComponent(adminCode || '')}`;
  return apiRequest('DELETE', `/api/users/${id}${query}`);
}

export function fetchActivityLogs(adminCode) {
  const query = `?adminCode=${encodeURIComponent(adminCode || '')}`;
  return apiRequest('GET', `/api/logs${query}`);
}

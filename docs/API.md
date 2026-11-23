# Referência da API HTTP — OpenCargo (ESP32)

O microcontrolador **ESP32** ([`firmware/sketch.ino`](../firmware/sketch.ino)) hospeda um servidor HTTP na **porta 80** (`WebServer server(80)`), respondendo a todas as rotas com payloads no formato `application/json; charset=utf-8` e cabeçalhos CORS.

---

## 1. Convenções Gerais e Autenticação Administrativa

- **Cabeçalhos CORS enviados em todas as respostas:**
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, X-Access-Code`
- **Preflight (`OPTIONS`):** Todas as rotas respondem a `HTTP_OPTIONS` com `HTTP 204 (No Content)`.
- **Autenticação Administrativa (`requireAdminAuth()`):**
  - Os endpoints restritos a administradores (`/api/users`, `/api/users/:id` e `/api/logs`) exigem o envio de um código pertencente a um usuário ativo com `role == "Administrador"` (código inicial: `00000`).
  - O firmware aceita o código de administrador em qualquer uma das três formas abaixo:
    1. **Query Parameter:** `?adminCode=00000` (ou `?code=00000`)
    2. **Cabeçalho HTTP:** `X-Access-Code: 00000`
    3. **Corpo JSON:** `"adminCode": "00000"`

---

## 2. Resumo dos Endpoints

| Método | Caminho | Autorização Admin? | Finalidade |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/status` | Não | Retorna estado geral do sistema, sensor físico e as 4 portas |
| `POST` | `/api/login` | Não | Valida um código de 5 dígitos e retorna dados públicos do usuário |
| `POST` | `/api/access` | Não *(valida permissão da porta)* | Solicita destrancamento temporizado (5s) via Painel ou Acesso Avulso |
| `GET` | `/api/users` | **Sim** | Lista todos os usuários ativos em memória RAM |
| `POST` | `/api/users` | **Sim** | Cadastra um novo usuário em memória RAM |
| `PUT` | `/api/users/:id` *(ou `/api/users`)* | **Sim** | Atualiza nome, código, cargo e permissões de um usuário |
| `DELETE` | `/api/users/:id` *(ou `/api/users`)* | **Sim** | Exclui um usuário em memória RAM (protege o Admin principal) |
| `GET` | `/api/logs` | **Sim** | Retorna até 50 registros recentes do histórico de atividades |
| `POST` | `/api/sensor/ack` | Não | Reconhece e limpa o estado de alerta de violação do sensor |
| `POST` | `/api/doors/control` | Não *(teste Etapa 2)* | Acionamento direto de LED para teste de hardware da Etapa 2 |

---

## 3. Detalhamento dos Endpoints

### 3.1 `GET /api/status`
Retorna o estado geral do ESP32, tempo de execução (`uptimeMs` e `relativeTime`), endereço IP, estado do sensor físico (`GPIO 33`) e estado das 4 fechaduras (`remainingMs` informa o tempo restante antes do travamento automático).

- **Autorização Administrativa:** Não exigida.
- **Parâmetros / Corpo:** Nenhum.
- **Códigos HTTP:** `200 OK`.
- **Exemplo de Resposta (`HTTP 200`):**
```json
{
  "system": "OpenCargo",
  "stage": 3,
  "online": true,
  "uptimeMs": 23969,
  "relativeTime": "00:00:23",
  "ip": "10.10.0.2",
  "unlockDurationMs": 5000,
  "sensor": {
    "pin": 33,
    "triggered": false,
    "state": "FECHADA",
    "alert": false
  },
  "doors": [
    { "id": 1, "name": "Porta 01 - Estoque", "pin": 25, "unlocked": false, "remainingMs": 0 },
    { "id": 2, "name": "Porta 02 - Administração", "pin": 26, "unlocked": false, "remainingMs": 0 },
    { "id": 3, "name": "Porta 03 - Produção", "pin": 27, "unlocked": false, "remainingMs": 0 },
    { "id": 4, "name": "Porta 04 - Laboratório", "pin": 14, "unlocked": false, "remainingMs": 0 }
  ]
}
```

---

### 3.2 `POST /api/login`
Valida o código de acesso informado pelo usuário na tela inicial e registra a tentativa no histórico.

- **Autorização Administrativa:** Não exigida.
- **Corpo JSON:**
```json
{
  "code": "12345"
}
```
- **Códigos HTTP:**
  - `200 OK`: Código válido.
  - `400 Bad Request`: Campo `code` vazio ou ausente (`reason: "CODE_REQUIRED"`).
  - `401 Unauthorized`: Código não pertence a nenhum usuário ativo (`reason: "USER_NOT_FOUND"`).
- **Resposta de Sucesso (`HTTP 200`):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso.",
  "user": {
    "id": 1,
    "name": "Ana Souza",
    "role": "Funcionário",
    "isAdmin": false,
    "isProtected": false,
    "permissions": [true, false, true, false]
  }
}
```
- **Resposta de Erro (`HTTP 401`):**
```json
{
  "success": false,
  "reason": "USER_NOT_FOUND",
  "message": "Usuário não encontrado."
}
```

---

### 3.3 `POST /api/access`
Solicita o destrancamento temporizado (`5000 ms`) de uma das quatro portas industriais. Utilizado tanto pelo **Painel do Usuário** (`"mode": "panel"`) quanto pelo **Acesso Avulso** (`"mode": "single"`).

- **Autorização Administrativa:** Não exigida (valida a permissão específica do usuário para a porta `doorId`).
- **Corpo JSON:**
```json
{
  "code": "12345",
  "doorId": 1,
  "mode": "panel"
}
```
- **Códigos HTTP:**
  - `200 OK`: Acesso autorizado; LED aceso por 5 segundos.
  - `400 Bad Request`: Código ausente (`reason: "CODE_REQUIRED"`).
  - `401 Unauthorized`: Código inexistente (`reason: "USER_NOT_FOUND"`).
  - `403 Forbidden`: Usuário existe, mas não possui permissão para a porta solicitada (`reason: "FORBIDDEN"`).
  - `404 Not Found`: `doorId` inválido (fora do intervalo `1..4`, `reason: "INVALID_DOOR"`).
- **Resposta Autorizada (`HTTP 200`):**
```json
{
  "success": true,
  "message": "Acesso autorizado. Porta destrancada.",
  "doorId": 1,
  "doorName": "Porta 01 - Estoque",
  "doorUnlocked": true,
  "unlockDurationMs": 5000,
  "user": {
    "id": 1,
    "name": "Ana Souza",
    "role": "Funcionário",
    "isAdmin": false,
    "isProtected": false,
    "permissions": [true, false, true, false]
  }
}
```
- **Resposta sem Permissão (`HTTP 403`):**
```json
{
  "success": false,
  "reason": "FORBIDDEN",
  "message": "Você não possui autorização para esta porta. A equipe de administração foi notificada."
}
```
- **Resposta de Código Inexistente (`HTTP 401`):**
```json
{
  "success": false,
  "reason": "USER_NOT_FOUND",
  "message": "Usuário não encontrado."
}
```

---

### 3.4 `GET /api/users`
Lista todos os usuários ativos cadastrados na memória RAM do ESP32.

- **Autorização Administrativa:** **Obrigatória** (`?adminCode=00000` ou header `X-Access-Code: 00000`).
- **Códigos HTTP:**
  - `200 OK`: Lista retornada com sucesso.
  - `403 Forbidden`: Código de administrador ausente ou inválido (`reason: "ADMIN_REQUIRED"`).
- **Resposta de Sucesso (`HTTP 200`):**
```json
{
  "success": true,
  "ramOnlyNotice": "Alterações ficam somente em memória RAM e são restauradas ao reiniciar o ESP32.",
  "users": [
    {
      "id": 1,
      "name": "Ana Souza",
      "code": "12345",
      "maskedCode": "***45",
      "role": "Funcionário",
      "isAdmin": false,
      "isProtected": false,
      "permissions": [true, false, true, false]
    },
    {
      "id": 4,
      "name": "Admin",
      "code": "00000",
      "maskedCode": "***00",
      "role": "Administrador",
      "isAdmin": true,
      "isProtected": true,
      "permissions": [true, true, true, true]
    }
  ]
}
```

---

### 3.5 `POST /api/users`
Cadastra um novo usuário na memória RAM do ESP32 (limite de até `MAX_USERS = 16`).

- **Autorização Administrativa:** **Obrigatória** (`adminCode` no JSON, query ou header).
- **Corpo JSON:**
```json
{
  "adminCode": "00000",
  "name": "Diego Rocha",
  "code": "45678",
  "role": "Supervisor",
  "permissions": [true, true, false, false]
}
```
- **Códigos HTTP:**
  - `201 Created`: Usuário criado com sucesso.
  - `400 Bad Request`: Campos obrigatórios ausentes (`VALIDATION_ERROR`) ou cargo inválido (`INVALID_ROLE`).
  - `403 Forbidden`: Solicitante não é administrador (`ADMIN_REQUIRED`).
  - `409 Conflict`: Já existe outro usuário com o mesmo `code` (`DUPLICATE_CODE`).
  - `507 Insufficient Storage`: Limite de 16 usuários em RAM atingido (`USERS_FULL`).
- **Resposta de Sucesso (`HTTP 201`):**
```json
{
  "success": true,
  "message": "Usuário cadastrado com sucesso.",
  "user": {
    "id": 5,
    "name": "Diego Rocha",
    "code": "45678",
    "maskedCode": "***78",
    "role": "Supervisor",
    "isAdmin": false,
    "isProtected": false,
    "permissions": [true, true, false, false]
  }
}
```

---

### 3.6 `PUT /api/users/:id` *(ou `PUT /api/users`)*
Atualiza os dados e as permissões de portas de um usuário existente em RAM.

- **Autorização Administrativa:** **Obrigatória**.
- **Parâmetros:** `:id` no caminho da URL (ex.: `/api/users/5`) ou `"id": 5` no corpo JSON.
- **Corpo JSON:**
```json
{
  "adminCode": "00000",
  "id": 5,
  "name": "Diego Rocha Silva",
  "code": "45678",
  "role": "Gerente",
  "permissions": [true, true, true, true]
}
```
- **Códigos HTTP:**
  - `200 OK`: Usuário atualizado com sucesso.
  - `400 Bad Request`: Cargo inválido (`INVALID_ROLE`).
  - `403 Forbidden`: Solicitante não é admin (`ADMIN_REQUIRED`) ou tentativa de rebaixar o cargo do Administrador principal (`PROTECTED_ADMIN`).
  - `404 Not Found`: ID de usuário não encontrado (`USER_NOT_FOUND`).
  - `409 Conflict`: Novo código já pertence a outro usuário (`DUPLICATE_CODE`).
- **Resposta de Sucesso (`HTTP 200`):**
```json
{
  "success": true,
  "message": "Usuário atualizado com sucesso.",
  "user": {
    "id": 5,
    "name": "Diego Rocha Silva",
    "code": "45678",
    "maskedCode": "***78",
    "role": "Gerente",
    "isAdmin": false,
    "isProtected": false,
    "permissions": [true, true, true, true]
  }
}
```

---

### 3.7 `DELETE /api/users/:id` *(ou `DELETE /api/users`)*
Remove um usuário da memória RAM do ESP32. O usuário Administrador principal (`id: 4`, `isProtected: true`) é protegido pelo firmware e não pode ser excluído.

- **Autorização Administrativa:** **Obrigatória** (`?adminCode=00000`).
- **Parâmetros:** `:id` no caminho da URL (ex.: `/api/users/5?adminCode=00000`) ou `"id"` no corpo JSON.
- **Códigos HTTP:**
  - `200 OK`: Usuário excluído com sucesso.
  - `403 Forbidden`: Solicitante não é admin (`ADMIN_REQUIRED`) ou tentativa de excluir o Administrador principal (`PROTECTED_ADMIN`).
  - `404 Not Found`: Usuário não encontrado (`USER_NOT_FOUND`).
- **Resposta de Sucesso (`HTTP 200`):**
```json
{
  "success": true,
  "message": "Usuário excluído com sucesso.",
  "deletedId": 5
}
```
- **Resposta de Proteção do Admin Principal (`HTTP 403`):**
```json
{
  "success": false,
  "reason": "PROTECTED_ADMIN",
  "message": "O administrador principal não pode ser excluído."
}
```

---

### 3.8 `GET /api/logs`
Consulta o histórico de atividades armazenado em memória RAM (até `MAX_LOGS = 50` registros, ordenados do mais recente ao mais antigo).

- **Autorização Administrativa:** **Obrigatória** (`?adminCode=00000`).
- **Códigos HTTP:**
  - `200 OK`: Histórico retornado com sucesso.
  - `403 Forbidden`: Solicitante não é administrador (`ADMIN_REQUIRED`).
- **Resposta de Sucesso (`HTTP 200`):**
```json
{
  "success": true,
  "timeReference": "uptime_millis",
  "total": 3,
  "logs": [
    {
      "id": 3,
      "timestampMs": 30453,
      "relativeTime": "00:00:30",
      "eventType": "TRAVAMENTO_AUTO",
      "userName": "Sistema",
      "maskedCode": "N/A",
      "doorId": 1,
      "doorName": "Porta 01 - Estoque",
      "result": "INFO",
      "reason": "Porta trancada automaticamente após tempo limite."
    },
    {
      "id": 2,
      "timestampMs": 25445,
      "relativeTime": "00:00:25",
      "eventType": "ACESSO",
      "userName": "Ana Souza",
      "maskedCode": "***45",
      "doorId": 1,
      "doorName": "Porta 01 - Estoque",
      "result": "AUTORIZADO",
      "reason": "Acesso autorizado e porta destrancada por 5s (Painel)."
    },
    {
      "id": 1,
      "timestampMs": 1845,
      "relativeTime": "00:00:01",
      "eventType": "SISTEMA",
      "userName": "Sistema",
      "maskedCode": "N/A",
      "doorId": 0,
      "doorName": "-",
      "result": "INFO",
      "reason": "Sistema iniciado com 4 usuários padrão carregados em RAM."
    }
  ]
}
```

---

### 3.9 `POST /api/sensor/ack`
Redefine o estado de alerta de violação do sensor físico (`sensorAlertActive = false`) e registra o reconhecimento no histórico.

- **Autorização Administrativa:** Não exigida.
- **Corpo JSON:** `{}`
- **Códigos HTTP:** `200 OK`.
- **Resposta (`HTTP 200`):**
```json
{
  "success": true,
  "message": "Alerta do sensor redefinido.",
  "alert": false
}
```

---

### 3.10 `POST /api/doors/control` *(Endpoint Auxiliar — Etapa 2)*
Endpoint mantido da Etapa 2 para testes diretos de hardware (ligar/desligar LEDs sem temporizador).

- **Corpo JSON:** `{ "doorId": 1, "unlocked": true }`
- **Códigos HTTP:** `200 OK`, `400 Bad Request`, `404 Not Found`.
- **Resposta (`HTTP 200`):**
```json
{
  "success": true,
  "message": "Porta destrancada com sucesso.",
  "doorId": 1,
  "name": "Porta 01 - Estoque",
  "doorUnlocked": true
}
```

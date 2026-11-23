#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>

// ============================================================================
// 1. Configurações de Rede e Constantes do Sistema
// ============================================================================
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const int WIFI_CHANNEL = 6;

// Tempo em que a porta permanece destrancada antes do travamento automático
const unsigned long DOOR_UNLOCK_DURATION_MS = 5000;

// Limites de armazenamento em memória RAM
const int MAX_USERS = 16;
const int MAX_LOGS = 50;

WebServer server(80);

// ============================================================================
// 2. Pinagem e Estrutura de Hardware (Portas e Sensor)
// ============================================================================
const int SENSOR_PIN = 33; // Botão simulando sensor magnético de porta (INPUT_PULLUP)
const unsigned long SENSOR_DEBOUNCE_MS = 40;

struct Door {
  int id;
  const char* name;
  int pin;
  bool unlocked;
  bool autoLockActive;
  unsigned long unlockedAtMs;
};

Door doors[] = {
  { 1, "Porta 01 - Estoque",       25, false, false, 0 },
  { 2, "Porta 02 - Administração", 26, false, false, 0 },
  { 3, "Porta 03 - Produção",      27, false, false, 0 },
  { 4, "Porta 04 - Laboratório",   14, false, false, 0 }
};

const int DOOR_COUNT = sizeof(doors) / sizeof(doors[0]);

bool lastSensorState = false;
unsigned long lastSensorChangeMs = 0;
bool sensorAlertActive = false;

// ============================================================================
// 3. Estrutura de Usuários e Permissões (Armazenamento em RAM)
// ============================================================================
struct User {
  bool active;
  int id;
  String name;
  String code;
  String role;
  bool permissions[4]; // Permissões para as portas 1, 2, 3 e 4
  bool isProtected;    // Protege o administrador principal contra exclusão/rebaixamento
};

User users[MAX_USERS];
int nextUserId = 1;

// ============================================================================
// 4. Estrutura de Histórico de Atividades / Logs (Armazenamento em RAM)
// ============================================================================
struct LogEntry {
  int id;
  unsigned long timestampMs;
  String eventType;  // LOGIN, ACESSO, TRAVAMENTO_AUTO, SENSOR, ADMIN
  String userName;
  String maskedCode;
  int doorId;
  String doorName;
  String result;     // AUTORIZADO, NEGADO, INFO, ALERTA
  String reason;
};

LogEntry activityLogs[MAX_LOGS];
int logCount = 0;
int nextLogId = 1;

// ============================================================================
// 5. Funções Auxiliares de Formatação, JSON e Segurança
// ============================================================================
String escapeJson(const String& input) {
  String out = "";
  out.reserve(input.length() + 4);
  for (unsigned int i = 0; i < input.length(); i++) {
    char c = input[i];
    if (c == '\"') out += "\\\"";
    else if (c == '\\') out += "\\\\";
    else if (c == '\n') out += "\\n";
    else if (c == '\r') out += "";
    else out += c;
  }
  return out;
}

// Mascara o código de acesso para nunca exibir códigos completos nos logs
String maskAccessCode(const String& code, bool userFound = true) {
  if (code.length() == 0) {
    return "Código desconhecido";
  }
  String suffix = (code.length() >= 2) ? code.substring(code.length() - 2) : code;
  String masked = "***" + suffix;
  if (!userFound) {
    masked += " (Desconhecido)";
  }
  return masked;
}

// Formata millis() em HH:MM:SS para exibição clara de horário relativo
String formatRelativeTime(unsigned long ms) {
  unsigned long totalSeconds = ms / 1000;
  unsigned long hours = totalSeconds / 3600;
  unsigned long minutes = (totalSeconds % 3600) / 60;
  unsigned long seconds = totalSeconds % 60;
  char buffer[16];
  snprintf(buffer, sizeof(buffer), "%02lu:%02lu:%02lu", hours, minutes, seconds);
  return String(buffer);
}

void addActivityLog(const char* eventType,
                    const String& userName,
                    const String& maskedCode,
                    int doorId,
                    const String& doorName,
                    const char* result,
                    const String& reason) {
  // Se atingir o limite de 50 registros, desloca para manter os 50 mais recentes
  if (logCount >= MAX_LOGS) {
    for (int i = 0; i < MAX_LOGS - 1; i++) {
      activityLogs[i] = activityLogs[i + 1];
    }
    logCount = MAX_LOGS - 1;
  }

  LogEntry& entry = activityLogs[logCount];
  entry.id = nextLogId++;
  entry.timestampMs = millis();
  entry.eventType = eventType;
  entry.userName = userName;
  entry.maskedCode = maskedCode;
  entry.doorId = doorId;
  entry.doorName = doorName;
  entry.result = result;
  entry.reason = reason;
  logCount++;

  Serial.printf("[LOG #%d | %s] %s | Usuário: %s (%s) | Porta: %s | %s -> %s\n",
                entry.id,
                formatRelativeTime(entry.timestampMs).c_str(),
                eventType,
                userName.c_str(),
                maskedCode.c_str(),
                doorName.c_str(),
                result,
                reason.c_str());
}

// ============================================================================
// 6. Gerenciamento de Usuários e Permissões em RAM
// ============================================================================
bool isAdminRole(const String& role) {
  return role.equalsIgnoreCase("Administrador");
}

bool isValidRole(const String& role) {
  return role == "Funcionário" ||
         role == "Funcionario" ||
         role == "Supervisor" ||
         role == "Gerente" ||
         role == "Administrador";
}

String normalizeRole(const String& role) {
  if (role == "Funcionario") return "Funcionário";
  return role;
}

void initDefaultUsers() {
  for (int i = 0; i < MAX_USERS; i++) {
    users[i].active = false;
  }
  nextUserId = 1;

  // 1. Ana Souza — Funcionário (Portas 01 e 03)
  users[0] = { true, nextUserId++, "Ana Souza", "12345", "Funcionário", { true, false, true, false }, false };
  // 2. Bruno Lima — Supervisor (Portas 01, 02 e 03)
  users[1] = { true, nextUserId++, "Bruno Lima", "23456", "Supervisor", { true, true, true, false }, false };
  // 3. Carla Mendes — Gerente (Portas 01, 02, 03 e 04)
  users[2] = { true, nextUserId++, "Carla Mendes", "34567", "Gerente", { true, true, true, true }, false };
  // 4. Admin — Administrador Principal (Acesso total + protegido)
  users[3] = { true, nextUserId++, "Admin", "00000", "Administrador", { true, true, true, true }, true };
}

User* findUserByCode(const String& code) {
  if (code.length() == 0) return nullptr;
  for (int i = 0; i < MAX_USERS; i++) {
    if (users[i].active && users[i].code == code) {
      return &users[i];
    }
  }
  return nullptr;
}

User* findUserById(int id) {
  if (id <= 0) return nullptr;
  for (int i = 0; i < MAX_USERS; i++) {
    if (users[i].active && users[i].id == id) {
      return &users[i];
    }
  }
  return nullptr;
}

bool isCodeInUse(const String& code, int ignoreUserId = -1) {
  for (int i = 0; i < MAX_USERS; i++) {
    if (users[i].active && users[i].id != ignoreUserId && users[i].code == code) {
      return true;
    }
  }
  return false;
}

bool userHasDoorPermission(const User* user, int doorId) {
  if (user == nullptr || doorId < 1 || doorId > DOOR_COUNT) return false;
  // Regra do firmware: Administrador possui acesso total
  if (isAdminRole(user->role)) return true;
  return user->permissions[doorId - 1];
}

// ============================================================================
// 7. Controle de Hardware (Portas, Travamento Automático e Sensor)
// ============================================================================
bool isSensorTriggered() {
  return digitalRead(SENSOR_PIN) == LOW;
}

Door* findDoorById(int doorId) {
  for (int i = 0; i < DOOR_COUNT; i++) {
    if (doors[i].id == doorId) {
      return &doors[i];
    }
  }
  return nullptr;
}

bool isAnyDoorUnlocked() {
  for (int i = 0; i < DOOR_COUNT; i++) {
    if (doors[i].unlocked) return true;
  }
  return false;
}

void setDoorState(int doorId, bool unlock, bool enableAutoLock = false) {
  Door* door = findDoorById(doorId);
  if (door != nullptr) {
    door->unlocked = unlock;
    door->autoLockActive = unlock && enableAutoLock;
    door->unlockedAtMs = unlock ? millis() : 0;
    digitalWrite(door->pin, unlock ? HIGH : LOW);
  }
}

void setAllDoorsState(bool unlock, bool enableAutoLock = false) {
  unsigned long now = millis();
  for (int i = 0; i < DOOR_COUNT; i++) {
    doors[i].unlocked = unlock;
    doors[i].autoLockActive = unlock && enableAutoLock;
    doors[i].unlockedAtMs = unlock ? now : 0;
    digitalWrite(doors[i].pin, unlock ? HIGH : LOW);
  }
}

unsigned long getDoorRemainingMs(const Door& door) {
  if (!door.unlocked || !door.autoLockActive) return 0;
  unsigned long elapsed = millis() - door.unlockedAtMs;
  if (elapsed >= DOOR_UNLOCK_DURATION_MS) return 0;
  return DOOR_UNLOCK_DURATION_MS - elapsed;
}

void updateDoorAutoLockTimers() {
  unsigned long now = millis();
  for (int i = 0; i < DOOR_COUNT; i++) {
    if (doors[i].unlocked && doors[i].autoLockActive) {
      if (now - doors[i].unlockedAtMs >= DOOR_UNLOCK_DURATION_MS) {
        doors[i].unlocked = false;
        doors[i].autoLockActive = false;
        doors[i].unlockedAtMs = 0;
        digitalWrite(doors[i].pin, LOW);

        addActivityLog("TRAVAMENTO_AUTO",
                       "Sistema",
                       "N/A",
                       doors[i].id,
                       doors[i].name,
                       "INFO",
                       "Porta trancada automaticamente após tempo limite.");
      }
    }
  }
}

void monitorSensorChanges() {
  bool currentSensorState = isSensorTriggered();
  if (currentSensorState != lastSensorState && (millis() - lastSensorChangeMs > SENSOR_DEBOUNCE_MS)) {
    lastSensorState = currentSensorState;
    lastSensorChangeMs = millis();

    Serial.printf("[SENSOR] Estado do sensor físico (GPIO %d) alterado para: %s\n",
                  SENSOR_PIN,
                  currentSensorState ? "ABERTA / ACIONADO (LOW)" : "FECHADA / NORMAL (HIGH)");

    if (currentSensorState) {
      if (!isAnyDoorUnlocked()) {
        sensorAlertActive = true;
        addActivityLog("SENSOR",
                       "Sensor Físico",
                       "N/A",
                       0,
                       "Sensor de Porta (GPIO 33)",
                       "ALERTA",
                       "Abertura física não autorizada detectada com portas trancadas!");
      } else {
        addActivityLog("SENSOR",
                       "Sensor Físico",
                       "N/A",
                       0,
                       "Sensor de Porta (GPIO 33)",
                       "INFO",
                       "Abertura física detectada durante destrancamento autorizado.");
      }
    } else {
      addActivityLog("SENSOR",
                     "Sensor Físico",
                     "N/A",
                     0,
                     "Sensor de Porta (GPIO 33)",
                     "INFO",
                     "Sensor físico retornou ao estado fechado.");
    }
  }
}

// ============================================================================
// 8. Extração e Serialização JSON (Sem dependências externas)
// ============================================================================
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Access-Code");
}

void sendJsonResponse(int statusCode, const String& jsonBody) {
  sendCorsHeaders();
  server.send(statusCode, "application/json; charset=utf-8", jsonBody);
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

// Extrai uma string de uma chave JSON (ex: "code": "12345")
String extractJsonString(const String& body, const char* key) {
  String pattern = String("\"") + key + "\"";
  int keyIndex = body.indexOf(pattern);
  if (keyIndex == -1) return "";

  int colonIndex = body.indexOf(':', keyIndex + pattern.length());
  if (colonIndex == -1) return "";

  int firstQuote = body.indexOf('\"', colonIndex + 1);
  if (firstQuote == -1) return "";

  String value = "";
  for (int i = firstQuote + 1; i < (int)body.length(); i++) {
    char c = body[i];
    if (c == '\\' && i + 1 < (int)body.length()) {
      value += body[i + 1];
      i++;
    } else if (c == '\"') {
      break;
    } else {
      value += c;
    }
  }
  value.trim();
  return value;
}

// Extrai um número inteiro simples de uma chave JSON (ex: "doorId": 1)
int extractJsonInt(const String& body, const char* key, int defaultValue = -1) {
  String pattern = String("\"") + key + "\"";
  int keyIndex = body.indexOf(pattern);
  if (keyIndex == -1) return defaultValue;

  int colonIndex = body.indexOf(':', keyIndex + pattern.length());
  if (colonIndex == -1) return defaultValue;

  int start = colonIndex + 1;
  while (start < (int)body.length() && (body[start] == ' ' || body[start] == '\n' || body[start] == '\r' || body[start] == '\t' || body[start] == '\"')) {
    start++;
  }

  int end = start;
  if (end < (int)body.length() && body[end] == '-') end++;
  while (end < (int)body.length() && isDigit(body[end])) {
    end++;
  }

  if (end == start) return defaultValue;
  return body.substring(start, end).toInt();
}

// Extrai um booleano simples de uma chave JSON (ex: "unlocked": true)
int extractJsonBool(const String& body, const char* key) {
  String pattern = String("\"") + key + "\"";
  int keyIndex = body.indexOf(pattern);
  if (keyIndex == -1) return -1;

  int colonIndex = body.indexOf(':', keyIndex + pattern.length());
  if (colonIndex == -1) return -1;

  String rest = body.substring(colonIndex + 1);
  rest.trim();
  if (rest.startsWith("true")) return 1;
  if (rest.startsWith("false")) return 0;
  return -1;
}

// Extrai o array de 4 booleanos "permissions": [true, false, true, false]
bool extractJsonPermissions(const String& body, bool outPerms[4]) {
  int keyIndex = body.indexOf("\"permissions\"");
  if (keyIndex == -1) return false;

  int openBracket = body.indexOf('[', keyIndex);
  int closeBracket = body.indexOf(']', openBracket);
  if (openBracket == -1 || closeBracket == -1) return false;

  String arrayContent = body.substring(openBracket + 1, closeBracket);
  int idx = 0;
  int start = 0;
  while (idx < 4 && start <= (int)arrayContent.length()) {
    int comma = arrayContent.indexOf(',', start);
    String token = (comma == -1) ? arrayContent.substring(start) : arrayContent.substring(start, comma);
    token.trim();
    if (token.startsWith("true") || token == "1") {
      outPerms[idx++] = true;
    } else if (token.startsWith("false") || token == "0") {
      outPerms[idx++] = false;
    } else {
      return false;
    }
    if (comma == -1) break;
    start = comma + 1;
  }
  return idx == 4;
}

String buildPermissionsArrayJson(const User& user) {
  bool admin = isAdminRole(user.role);
  String json = "[";
  for (int i = 0; i < 4; i++) {
    if (i > 0) json += ",";
    bool allowed = admin ? true : user.permissions[i];
    json += allowed ? "true" : "false";
  }
  json += "]";
  return json;
}

String buildPublicUserJson(const User& user) {
  String json = "{";
  json += "\"id\":" + String(user.id) + ",";
  json += "\"name\":\"" + escapeJson(user.name) + "\",";
  json += "\"role\":\"" + escapeJson(user.role) + "\",";
  json += "\"isAdmin\":" + String(isAdminRole(user.role) ? "true" : "false") + ",";
  json += "\"isProtected\":" + String(user.isProtected ? "true" : "false") + ",";
  json += "\"permissions\":" + buildPermissionsArrayJson(user);
  json += "}";
  return json;
}

String buildAdminUserJson(const User& user) {
  String json = "{";
  json += "\"id\":" + String(user.id) + ",";
  json += "\"name\":\"" + escapeJson(user.name) + "\",";
  json += "\"code\":\"" + escapeJson(user.code) + "\",";
  json += "\"maskedCode\":\"" + escapeJson(maskAccessCode(user.code, true)) + "\",";
  json += "\"role\":\"" + escapeJson(user.role) + "\",";
  json += "\"isAdmin\":" + String(isAdminRole(user.role) ? "true" : "false") + ",";
  json += "\"isProtected\":" + String(user.isProtected ? "true" : "false") + ",";
  json += "\"permissions\":" + buildPermissionsArrayJson(user);
  json += "}";
  return json;
}

String buildStatusJson() {
  bool sensorActive = isSensorTriggered();

  String json = "{";
  json += "\"system\":\"OpenCargo\",";
  json += "\"stage\":3,";
  json += "\"online\":true,";
  json += "\"uptimeMs\":" + String(millis()) + ",";
  json += "\"relativeTime\":\"" + formatRelativeTime(millis()) + "\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"unlockDurationMs\":" + String(DOOR_UNLOCK_DURATION_MS) + ",";

  json += "\"sensor\":{";
  json += "\"pin\":" + String(SENSOR_PIN) + ",";
  json += "\"triggered\":" + String(sensorActive ? "true" : "false") + ",";
  json += "\"state\":\"" + String(sensorActive ? "ABERTA" : "FECHADA") + "\",";
  json += "\"alert\":" + String(sensorAlertActive ? "true" : "false");
  json += "},";

  json += "\"doors\":[";
  for (int i = 0; i < DOOR_COUNT; i++) {
    if (i > 0) json += ",";
    json += "{";
    json += "\"id\":" + String(doors[i].id) + ",";
    json += "\"name\":\"" + String(doors[i].name) + "\",";
    json += "\"pin\":" + String(doors[i].pin) + ",";
    json += "\"unlocked\":" + String(doors[i].unlocked ? "true" : "false") + ",";
    json += "\"remainingMs\":" + String(getDoorRemainingMs(doors[i]));
    json += "}";
  }
  json += "]";
  json += "}";

  return json;
}

String buildDoorActionJson(const Door* door) {
  String json = "{";
  json += "\"success\":true,";
  json += "\"message\":\"" + String(door->unlocked ? "Porta destrancada com sucesso." : "Porta trancada com sucesso.") + "\",";
  json += "\"doorId\":" + String(door->id) + ",";
  json += "\"name\":\"" + String(door->name) + "\",";
  json += "\"doorUnlocked\":" + String(door->unlocked ? "true" : "false");
  json += "}";
  return json;
}

// ============================================================================
// 9. Autenticação de Administrador nas Requisições HTTP
// ============================================================================
String extractAdminCodeFromRequest() {
  if (server.hasArg("adminCode")) return server.arg("adminCode");
  if (server.hasArg("code")) return server.arg("code");
  if (server.hasHeader("X-Access-Code")) return server.header("X-Access-Code");
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    String adminCode = extractJsonString(body, "adminCode");
    if (adminCode.length() > 0) return adminCode;
    return extractJsonString(body, "code");
  }
  return "";
}

User* requireAdminAuth() {
  String adminCode = extractAdminCodeFromRequest();
  User* user = findUserByCode(adminCode);
  if (user == nullptr || !isAdminRole(user->role)) {
    sendJsonResponse(403, "{\"success\":false,\"reason\":\"ADMIN_REQUIRED\",\"message\":\"Acesso negado. Código de administrador inválido ou ausente.\"}");
    return nullptr;
  }
  return user;
}

// ============================================================================
// 10. Handlers dos Endpoints HTTP
// ============================================================================

// GET /api/status
void handleGetStatus() {
  sendJsonResponse(200, buildStatusJson());
}

// POST /api/login
// Payload: { "code": "12345" }
void handlePostLogin() {
  String body = server.hasArg("plain") ? server.arg("plain") : "";
  String code = extractJsonString(body, "code");

  if (code.length() == 0) {
    sendJsonResponse(400, "{\"success\":false,\"reason\":\"CODE_REQUIRED\",\"message\":\"Informe o código de acesso.\"}");
    return;
  }

  User* user = findUserByCode(code);
  if (user == nullptr) {
    addActivityLog("LOGIN",
                   "Desconhecido",
                   maskAccessCode(code, false),
                   0,
                   "-",
                   "NEGADO",
                   "Tentativa de login com código inexistente.");
    sendJsonResponse(401, "{\"success\":false,\"reason\":\"USER_NOT_FOUND\",\"message\":\"Usuário não encontrado.\"}");
    return;
  }

  addActivityLog("LOGIN",
                 user->name,
                 maskAccessCode(user->code, true),
                 0,
                 "-",
                 "AUTORIZADO",
                 "Login realizado (" + user->role + ").");

  String json = "{";
  json += "\"success\":true,";
  json += "\"message\":\"Login realizado com sucesso.\",";
  json += "\"user\":" + buildPublicUserJson(*user);
  json += "}";
  sendJsonResponse(200, json);
}

// POST /api/access (Usado tanto pelo Painel do Usuário quanto pelo Acesso Avulso)
// Payload: { "code": "12345", "doorId": 1, "mode": "single" }
void handlePostAccess() {
  String body = server.hasArg("plain") ? server.arg("plain") : "";
  String code = extractJsonString(body, "code");
  int doorId = extractJsonInt(body, "doorId", -1);
  String mode = extractJsonString(body, "mode");
  String modeLabel = (mode == "single" || mode == "avulso") ? "Acesso avulso" : "Painel";

  Door* door = findDoorById(doorId);
  if (door == nullptr) {
    sendJsonResponse(404, "{\"success\":false,\"reason\":\"INVALID_DOOR\",\"message\":\"Porta inválida. Escolha uma porta entre 1 e 4.\"}");
    return;
  }

  if (code.length() == 0) {
    sendJsonResponse(400, "{\"success\":false,\"reason\":\"CODE_REQUIRED\",\"message\":\"Informe o código de acesso.\"}");
    return;
  }

  User* user = findUserByCode(code);
  if (user == nullptr) {
    addActivityLog("ACESSO",
                   "Desconhecido",
                   maskAccessCode(code, false),
                   door->id,
                   door->name,
                   "NEGADO",
                   "Código inexistente (" + modeLabel + ").");
    sendJsonResponse(401, "{\"success\":false,\"reason\":\"USER_NOT_FOUND\",\"message\":\"Usuário não encontrado.\"}");
    return;
  }

  if (!userHasDoorPermission(user, door->id)) {
    addActivityLog("ACESSO",
                   user->name,
                   maskAccessCode(user->code, true),
                   door->id,
                   door->name,
                   "NEGADO",
                   "Usuário sem permissão para esta porta (" + modeLabel + ").");
    sendJsonResponse(403, "{\"success\":false,\"reason\":\"FORBIDDEN\",\"message\":\"Você não possui autorização para esta porta. A equipe de administração foi notificada.\"}");
    return;
  }

  // Autorizado: destranca a porta com temporizador automático
  setDoorState(door->id, true, true);

  addActivityLog("ACESSO",
                 user->name,
                 maskAccessCode(user->code, true),
                 door->id,
                 door->name,
                 "AUTORIZADO",
                 "Acesso autorizado e porta destrancada por " + String(DOOR_UNLOCK_DURATION_MS / 1000) + "s (" + modeLabel + ").");

  String json = "{";
  json += "\"success\":true,";
  json += "\"message\":\"Acesso autorizado. Porta destrancada.\",";
  json += "\"doorId\":" + String(door->id) + ",";
  json += "\"doorName\":\"" + String(door->name) + "\",";
  json += "\"doorUnlocked\":true,";
  json += "\"unlockDurationMs\":" + String(DOOR_UNLOCK_DURATION_MS) + ",";
  json += "\"user\":" + buildPublicUserJson(*user);
  json += "}";
  sendJsonResponse(200, json);
}

// GET /api/users (Admin)
void handleGetUsers() {
  if (requireAdminAuth() == nullptr) return;

  String json = "{\"success\":true,\"ramOnlyNotice\":\"Alterações ficam somente em memória RAM e são restauradas ao reiniciar o ESP32.\",\"users\":[";
  bool first = true;
  for (int i = 0; i < MAX_USERS; i++) {
    if (!users[i].active) continue;
    if (!first) json += ",";
    first = false;
    json += buildAdminUserJson(users[i]);
  }
  json += "]}";
  sendJsonResponse(200, json);
}

// POST /api/users (Admin - Cadastrar novo usuário)
// Payload: { "adminCode": "00000", "name": "Novo", "code": "55555", "role": "Funcionário", "permissions": [true,false,false,false] }
void handlePostCreateUser() {
  User* admin = requireAdminAuth();
  if (admin == nullptr) return;

  String body = server.hasArg("plain") ? server.arg("plain") : "";
  String name = extractJsonString(body, "name");
  String userCode = extractJsonString(body, "userCode");
  if (userCode.length() == 0) {
    // Se "adminCode" foi enviado separado, "code" é o código do novo usuário
    if (extractJsonString(body, "adminCode").length() > 0 || server.hasArg("adminCode") || server.hasHeader("X-Access-Code")) {
      userCode = extractJsonString(body, "code");
    }
  }
  String role = normalizeRole(extractJsonString(body, "role"));

  if (name.length() == 0 || userCode.length() == 0 || role.length() == 0) {
    sendJsonResponse(400, "{\"success\":false,\"reason\":\"VALIDATION_ERROR\",\"message\":\"Nome, código e cargo são obrigatórios.\"}");
    return;
  }

  if (!isValidRole(role)) {
    sendJsonResponse(400, "{\"success\":false,\"reason\":\"INVALID_ROLE\",\"message\":\"Cargo inválido. Use Funcionário, Supervisor, Gerente ou Administrador.\"}");
    return;
  }

  if (isCodeInUse(userCode)) {
    sendJsonResponse(409, "{\"success\":false,\"reason\":\"DUPLICATE_CODE\",\"message\":\"Já existe um usuário com este código de acesso.\"}");
    return;
  }

  int freeSlot = -1;
  for (int i = 0; i < MAX_USERS; i++) {
    if (!users[i].active) {
      freeSlot = i;
      break;
    }
  }

  if (freeSlot == -1) {
    sendJsonResponse(507, "{\"success\":false,\"reason\":\"USERS_FULL\",\"message\":\"Limite máximo de usuários em RAM atingido.\"}");
    return;
  }

  bool perms[4] = { false, false, false, false };
  if (isAdminRole(role)) {
    perms[0] = perms[1] = perms[2] = perms[3] = true;
  } else {
    extractJsonPermissions(body, perms);
  }

  users[freeSlot].active = true;
  users[freeSlot].id = nextUserId++;
  users[freeSlot].name = name;
  users[freeSlot].code = userCode;
  users[freeSlot].role = role;
  for (int p = 0; p < 4; p++) {
    users[freeSlot].permissions[p] = perms[p];
  }
  users[freeSlot].isProtected = false;

  addActivityLog("ADMIN",
                 admin->name,
                 maskAccessCode(admin->code, true),
                 0,
                 "-",
                 "INFO",
                 "Cadastrou usuário '" + name + "' (" + role + ").");

  String json = "{\"success\":true,\"message\":\"Usuário cadastrado com sucesso.\",\"user\":" + buildAdminUserJson(users[freeSlot]) + "}";
  sendJsonResponse(201, json);
}

// PUT /api/users ou PUT /api/users/:id (Admin - Atualizar usuário)
void handlePutUpdateUser(int pathUserId = -1) {
  User* admin = requireAdminAuth();
  if (admin == nullptr) return;

  String body = server.hasArg("plain") ? server.arg("plain") : "";
  int targetId = (pathUserId > 0) ? pathUserId : extractJsonInt(body, "id", server.hasArg("id") ? server.arg("id").toInt() : -1);

  User* target = findUserById(targetId);
  if (target == nullptr) {
    sendJsonResponse(404, "{\"success\":false,\"reason\":\"USER_NOT_FOUND\",\"message\":\"Usuário para edição não encontrado.\"}");
    return;
  }

  String name = extractJsonString(body, "name");
  if (name.length() == 0) name = target->name;

  String newCode = extractJsonString(body, "userCode");
  if (newCode.length() == 0) {
    if (extractJsonString(body, "adminCode").length() > 0 || server.hasArg("adminCode") || server.hasHeader("X-Access-Code")) {
      newCode = extractJsonString(body, "code");
    }
  }
  if (newCode.length() == 0) newCode = target->code;

  String role = normalizeRole(extractJsonString(body, "role"));
  if (role.length() == 0) role = target->role;

  if (!isValidRole(role)) {
    sendJsonResponse(400, "{\"success\":false,\"reason\":\"INVALID_ROLE\",\"message\":\"Cargo inválido.\"}");
    return;
  }

  if (target->isProtected && !isAdminRole(role)) {
    sendJsonResponse(403, "{\"success\":false,\"reason\":\"PROTECTED_ADMIN\",\"message\":\"O cargo do administrador principal não pode ser rebaixado.\"}");
    return;
  }

  if (isCodeInUse(newCode, target->id)) {
    sendJsonResponse(409, "{\"success\":false,\"reason\":\"DUPLICATE_CODE\",\"message\":\"Já existe outro usuário utilizando este código.\"}");
    return;
  }

  bool perms[4] = {
    target->permissions[0],
    target->permissions[1],
    target->permissions[2],
    target->permissions[3]
  };

  if (isAdminRole(role) || target->isProtected) {
    perms[0] = perms[1] = perms[2] = perms[3] = true;
  } else {
    extractJsonPermissions(body, perms);
  }

  target->name = name;
  target->code = newCode;
  target->role = role;
  for (int p = 0; p < 4; p++) {
    target->permissions[p] = perms[p];
  }

  addActivityLog("ADMIN",
                 admin->name,
                 maskAccessCode(admin->code, true),
                 0,
                 "-",
                 "INFO",
                 "Atualizou usuário '" + target->name + "' (ID " + String(target->id) + ").");

  String json = "{\"success\":true,\"message\":\"Usuário atualizado com sucesso.\",\"user\":" + buildAdminUserJson(*target) + "}";
  sendJsonResponse(200, json);
}

// DELETE /api/users ou DELETE /api/users/:id (Admin - Excluir usuário)
void handleDeleteUser(int pathUserId = -1) {
  User* admin = requireAdminAuth();
  if (admin == nullptr) return;

  String body = server.hasArg("plain") ? server.arg("plain") : "";
  int targetId = (pathUserId > 0) ? pathUserId : extractJsonInt(body, "id", server.hasArg("id") ? server.arg("id").toInt() : -1);

  User* target = findUserById(targetId);
  if (target == nullptr) {
    sendJsonResponse(404, "{\"success\":false,\"reason\":\"USER_NOT_FOUND\",\"message\":\"Usuário para exclusão não encontrado.\"}");
    return;
  }

  if (target->isProtected) {
    sendJsonResponse(403, "{\"success\":false,\"reason\":\"PROTECTED_ADMIN\",\"message\":\"O administrador principal não pode ser excluído.\"}");
    return;
  }

  String deletedName = target->name;
  int deletedId = target->id;
  target->active = false;

  addActivityLog("ADMIN",
                 admin->name,
                 maskAccessCode(admin->code, true),
                 0,
                 "-",
                 "INFO",
                 "Excluiu usuário '" + deletedName + "' (ID " + String(deletedId) + ").");

  sendJsonResponse(200, "{\"success\":true,\"message\":\"Usuário excluído com sucesso.\",\"deletedId\":" + String(deletedId) + "}");
}

// GET /api/logs (Admin - Consultar histórico de atividades)
void handleGetLogs() {
  if (requireAdminAuth() == nullptr) return;

  String json = "{";
  json += "\"success\":true,";
  json += "\"timeReference\":\"uptime_millis\",";
  json += "\"total\":" + String(logCount) + ",";
  json += "\"logs\":[";

  // Retorna do evento mais recente para o mais antigo
  bool first = true;
  for (int i = logCount - 1; i >= 0; i--) {
    if (!first) json += ",";
    first = false;
    const LogEntry& e = activityLogs[i];
    json += "{";
    json += "\"id\":" + String(e.id) + ",";
    json += "\"timestampMs\":" + String(e.timestampMs) + ",";
    json += "\"relativeTime\":\"" + formatRelativeTime(e.timestampMs) + "\",";
    json += "\"eventType\":\"" + escapeJson(e.eventType) + "\",";
    json += "\"userName\":\"" + escapeJson(e.userName) + "\",";
    json += "\"maskedCode\":\"" + escapeJson(e.maskedCode) + "\",";
    json += "\"doorId\":" + String(e.doorId) + ",";
    json += "\"doorName\":\"" + escapeJson(e.doorName) + "\",";
    json += "\"result\":\"" + escapeJson(e.result) + "\",";
    json += "\"reason\":\"" + escapeJson(e.reason) + "\"";
    json += "}";
  }

  json += "]}";
  sendJsonResponse(200, json);
}

// POST /api/sensor/ack (Limpar alerta de violação do sensor)
void handlePostSensorAck() {
  sensorAlertActive = false;
  addActivityLog("SENSOR",
                 "Operador",
                 "N/A",
                 0,
                 "Sensor de Porta (GPIO 33)",
                 "INFO",
                 "Alerta de sensor reconhecido/redefinido pela interface.");
  sendJsonResponse(200, "{\"success\":true,\"message\":\"Alerta do sensor redefinido.\",\"alert\":false}");
}

// POST /api/doors/control (Mantido da Etapa 2 para compatibilidade de testes diretos)
void handlePostDoorControl() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"success\":false,\"reason\":\"BAD_REQUEST\",\"message\":\"Corpo JSON ausente.\"}");
    return;
  }

  String body = server.arg("plain");
  int doorId = extractJsonInt(body, "doorId", -1);
  Door* door = findDoorById(doorId);

  if (door == nullptr) {
    sendJsonResponse(404, "{\"success\":false,\"reason\":\"INVALID_DOOR\",\"message\":\"Porta inválida. Use um doorId entre 1 e 4.\"}");
    return;
  }

  int requestedState = extractJsonBool(body, "unlocked");
  bool shouldUnlock = (requestedState == -1) ? !door->unlocked : (requestedState == 1);

  setDoorState(doorId, shouldUnlock, false);

  Serial.printf("[HTTP] POST /api/doors/control -> %s: %s\n",
                door->name,
                door->unlocked ? "DESTRANCADA (LED ON)" : "TRANCADA (LED OFF)");
  sendJsonResponse(200, buildDoorActionJson(door));
}

// Roteamento complementar para /api/users/:id e preflight OPTIONS
void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  String uri = server.uri();
  if (uri.startsWith("/api/users/")) {
    int pathId = uri.substring(String("/api/users/").length()).toInt();
    if (pathId > 0) {
      if (server.method() == HTTP_PUT) {
        handlePutUpdateUser(pathId);
        return;
      } else if (server.method() == HTTP_DELETE) {
        handleDeleteUser(pathId);
        return;
      }
    }
  }

  sendJsonResponse(404, "{\"success\":false,\"reason\":\"NOT_FOUND\",\"message\":\"Endpoint não encontrado.\"}");
}

// ============================================================================
// 11. Autoteste HTTP Real Completo (Valida Etapa 2 + Etapa 3 na Porta 80)
// ============================================================================
bool selfTestRunning = false;

void httpSelfTestTask(void* parameter) {
  selfTestRunning = true;
  Serial.println("\n================ INICIANDO AUTOTESTE HTTP (ETAPA 2 + ETAPA 3) ================");

  HTTPClient http;
  int code = 0;

  // 1. GET /api/status
  http.begin("http://127.0.0.1/api/status");
  code = http.GET();
  Serial.printf("[TESTE 1] GET /api/status -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(250));

  // 2. POST /api/login para os 4 perfis (Funcionário, Supervisor, Gerente, Administrador) e 1 código inválido
  const char* loginCodes[] = { "12345", "23456", "34567", "00000", "99999" };
  for (int i = 0; i < 5; i++) {
    http.begin("http://127.0.0.1/api/login");
    http.addHeader("Content-Type", "application/json");
    String payload = String("{\"code\":\"") + loginCodes[i] + "\"}";
    code = http.POST(payload);
    Serial.printf("[TESTE 2.%d] POST /api/login (%s) -> HTTP %d | %s\n", i + 1, loginCodes[i], code, http.getString().c_str());
    http.end();
    vTaskDelay(pdMS_TO_TICKS(150));
  }

  // 3. POST /api/access (Autorizados nas 4 portas com os 4 perfis -> Acende os 4 LEDs por 5s)
  const char* doorTestPayloads[] = {
    "{\"code\":\"12345\",\"doorId\":1,\"mode\":\"panel\"}",  // Funcionário -> Porta 01
    "{\"code\":\"23456\",\"doorId\":2,\"mode\":\"panel\"}",  // Supervisor  -> Porta 02
    "{\"code\":\"34567\",\"doorId\":3,\"mode\":\"panel\"}",  // Gerente     -> Porta 03
    "{\"code\":\"00000\",\"doorId\":4,\"mode\":\"single\"}"  // Admin       -> Porta 04
  };
  for (int i = 0; i < 4; i++) {
    http.begin("http://127.0.0.1/api/access");
    http.addHeader("Content-Type", "application/json");
    code = http.POST(doorTestPayloads[i]);
    Serial.printf("[TESTE 3.%d] POST /api/access (Porta %d Autorizada) -> HTTP %d | %s\n", i + 1, i + 1, code, http.getString().c_str());
    http.end();
    vTaskDelay(pdMS_TO_TICKS(150));
  }

  // 4. POST /api/access (Negado / Sem Permissão: Funcionário 12345 na Porta 2 e Supervisor 23456 na Porta 4)
  http.begin("http://127.0.0.1/api/access");
  http.addHeader("Content-Type", "application/json");
  code = http.POST("{\"code\":\"12345\",\"doorId\":2,\"mode\":\"single\"}");
  Serial.printf("[TESTE 4] POST /api/access (Ana -> Porta 2 Sem Permissão) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(150));

  http.begin("http://127.0.0.1/api/access");
  http.addHeader("Content-Type", "application/json");
  code = http.POST("{\"code\":\"23456\",\"doorId\":4,\"mode\":\"panel\"}");
  Serial.printf("[TESTE 5] POST /api/access (Bruno -> Porta 4 Sem Permissão) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(150));

  // 6. POST /api/access (Código inexistente no Acesso Avulso: 88888 na Porta 3)
  http.begin("http://127.0.0.1/api/access");
  http.addHeader("Content-Type", "application/json");
  code = http.POST("{\"code\":\"88888\",\"doorId\":3,\"mode\":\"single\"}");
  Serial.printf("[TESTE 6] POST /api/access (Código 88888 -> Porta 3) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(150));

  // 7. GET /api/users (Sem ser admin: Ana 12345 -> Deve bloquear 403)
  http.begin("http://127.0.0.1/api/users?adminCode=12345");
  code = http.GET();
  Serial.printf("[TESTE 7] GET /api/users (Não-Admin 12345) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(250));

  // 8. POST /api/users (Admin 00000 cria novo usuário Diego Rocha - 45678)
  http.begin("http://127.0.0.1/api/users");
  http.addHeader("Content-Type", "application/json");
  code = http.POST("{\"adminCode\":\"00000\",\"name\":\"Diego Rocha\",\"code\":\"45678\",\"role\":\"Supervisor\",\"permissions\":[true,true,false,false]}");
  Serial.printf("[TESTE 8] POST /api/users (Criar Diego Rocha) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(250));

  // 9. PUT /api/users/5 (Admin 00000 atualiza Diego Rocha para Gerente)
  http.begin("http://127.0.0.1/api/users/5");
  http.addHeader("Content-Type", "application/json");
  code = http.PUT("{\"adminCode\":\"00000\",\"name\":\"Diego Rocha\",\"code\":\"45678\",\"role\":\"Gerente\",\"permissions\":[true,true,true,true]}");
  Serial.printf("[TESTE 9] PUT /api/users/5 (Atualizar Diego Rocha) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(250));

  // 10. DELETE /api/users/4 (Tentativa de excluir Admin principal -> Deve bloquear 403)
  http.begin("http://127.0.0.1/api/users/4?adminCode=00000");
  code = http.sendRequest("DELETE");
  Serial.printf("[TESTE 10] DELETE /api/users/4 (Proteção Admin Principal) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(250));

  // 11. DELETE /api/users/5 (Excluir Diego Rocha -> Deve retornar 200)
  http.begin("http://127.0.0.1/api/users/5?adminCode=00000");
  code = http.sendRequest("DELETE");
  Serial.printf("[TESTE 11] DELETE /api/users/5 (Excluir Diego Rocha) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();

  // 12. Aguardar o travamento automático das 4 Portas (destrancadas no Teste 3 por 5s)
  Serial.println("[TESTE 12] Aguardando travamento automático das 4 Portas (5 segundos)...");
  vTaskDelay(pdMS_TO_TICKS(4200));

  http.begin("http://127.0.0.1/api/status");
  code = http.GET();
  Serial.printf("[TESTE 12] GET /api/status (Após travamento automático) -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();
  vTaskDelay(pdMS_TO_TICKS(250));

  // 13. GET /api/logs (Admin 00000 consulta histórico completo)
  http.begin("http://127.0.0.1/api/logs?adminCode=00000");
  code = http.GET();
  Serial.printf("[TESTE 13] GET /api/logs?adminCode=00000 -> HTTP %d | %s\n", code, http.getString().c_str());
  http.end();

  Serial.println("================ AUTOTESTE HTTP CONCLUÍDO COM SUCESSO ================\n");
  selfTestRunning = false;
  vTaskDelete(NULL);
}

void startHttpSelfTest() {
  if (selfTestRunning) {
    Serial.println("[TESTE] O autoteste HTTP já está em execução.");
    return;
  }
  xTaskCreatePinnedToCore(httpSelfTestTask, "HttpSelfTest", 10240, NULL, 1, NULL, 0);
}

// ============================================================================
// 12. Interface de Comandos via Monitor Serial (Etapa 2 + Etapa 3)
// ============================================================================
void printSerialHelp() {
  Serial.println("\n------------------------------------------------------------");
  Serial.println("Comandos disponíveis no Monitor Serial (Etapa 2 + Etapa 3):");
  Serial.println("  test                 -> Executa bateria completa de testes HTTP na porta 80");
  Serial.println("  status               -> Exibe o JSON do endpoint GET /api/status");
  Serial.println("  users                -> Lista os usuários ativos em RAM");
  Serial.println("  logs                 -> Exibe o histórico de atividades em RAM");
  Serial.println("  login <code>         -> Simula login com um código (ex: login 12345)");
  Serial.println("  access <code> <porta>-> Solicita acesso temporizado (ex: access 12345 1)");
  Serial.println("  unlock <n>           -> Destranca manualmente a porta <n> (1 a 4)");
  Serial.println("  lock <n>             -> Tranca manualmente a porta <n> (1 a 4)");
  Serial.println("  unlock all           -> Destranca todas as 4 portas");
  Serial.println("  lock all             -> Tranca todas as 4 portas");
  Serial.println("  help                 -> Exibe esta lista de comandos");
  Serial.println("------------------------------------------------------------\n");
}

void handleSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.equalsIgnoreCase("test")) {
    startHttpSelfTest();
  } else if (cmd.equalsIgnoreCase("status")) {
    Serial.println("[SERIAL] GET /api/status ->");
    Serial.println(buildStatusJson());
  } else if (cmd.equalsIgnoreCase("users")) {
    Serial.println("[SERIAL] Usuários ativos em RAM:");
    for (int i = 0; i < MAX_USERS; i++) {
      if (users[i].active) {
        Serial.println("  " + buildAdminUserJson(users[i]));
      }
    }
  } else if (cmd.equalsIgnoreCase("logs")) {
    Serial.printf("[SERIAL] Histórico de atividades (%d eventos):\n", logCount);
    for (int i = logCount - 1; i >= 0; i--) {
      const LogEntry& e = activityLogs[i];
      Serial.printf("  #%d [%s] %s | %s (%s) | Porta: %s | %s: %s\n",
                    e.id,
                    formatRelativeTime(e.timestampMs).c_str(),
                    e.eventType.c_str(),
                    e.userName.c_str(),
                    e.maskedCode.c_str(),
                    e.doorName.c_str(),
                    e.result.c_str(),
                    e.reason.c_str());
    }
  } else if (cmd.startsWith("login ") || cmd.startsWith("LOGIN ")) {
    String code = cmd.substring(6);
    code.trim();
    User* u = findUserByCode(code);
    if (u == nullptr) {
      addActivityLog("LOGIN", "Desconhecido", maskAccessCode(code, false), 0, "-", "NEGADO", "Código inexistente via Serial.");
    } else {
      addActivityLog("LOGIN", u->name, maskAccessCode(u->code, true), 0, "-", "AUTORIZADO", "Login via Serial (" + u->role + ").");
      Serial.println(buildPublicUserJson(*u));
    }
  } else if (cmd.startsWith("access ") || cmd.startsWith("ACCESS ")) {
    String args = cmd.substring(7);
    args.trim();
    int spaceIdx = args.indexOf(' ');
    if (spaceIdx == -1) {
      Serial.println("[SERIAL] Uso: access <codigo> <porta>");
      return;
    }
    String code = args.substring(0, spaceIdx);
    int doorId = args.substring(spaceIdx + 1).toInt();
    Door* door = findDoorById(doorId);
    User* user = findUserByCode(code);
    if (door == nullptr) {
      Serial.println("{\"success\":false,\"reason\":\"INVALID_DOOR\",\"message\":\"Porta inválida.\"}");
    } else if (user == nullptr) {
      addActivityLog("ACESSO", "Desconhecido", maskAccessCode(code, false), door->id, door->name, "NEGADO", "Código inexistente.");
      Serial.println("{\"success\":false,\"reason\":\"USER_NOT_FOUND\",\"message\":\"Usuário não encontrado.\"}");
    } else if (!userHasDoorPermission(user, doorId)) {
      addActivityLog("ACESSO", user->name, maskAccessCode(user->code, true), door->id, door->name, "NEGADO", "Sem permissão para esta porta.");
      Serial.println("{\"success\":false,\"reason\":\"FORBIDDEN\",\"message\":\"Você não possui autorização para esta porta.\"}");
    } else {
      setDoorState(doorId, true, true);
      addActivityLog("ACESSO", user->name, maskAccessCode(user->code, true), door->id, door->name, "AUTORIZADO", "Destrancamento temporizado (5s).");
      Serial.println("{\"success\":true,\"message\":\"Acesso autorizado. Porta destrancada.\"}");
    }
  } else if (cmd.equalsIgnoreCase("unlock all")) {
    setAllDoorsState(true, false);
    Serial.println("[SERIAL] Todas as 4 portas foram DESTRANCADAS (LEDs acesos).");
    Serial.println(buildStatusJson());
  } else if (cmd.equalsIgnoreCase("lock all")) {
    setAllDoorsState(false, false);
    Serial.println("[SERIAL] Todas as 4 portas foram TRANCADAS (LEDs apagados).");
    Serial.println(buildStatusJson());
  } else if (cmd.startsWith("unlock ") || cmd.startsWith("UNLOCK ")) {
    int doorId = cmd.substring(7).toInt();
    Door* door = findDoorById(doorId);
    if (door != nullptr) {
      setDoorState(doorId, true, false);
      Serial.println(buildDoorActionJson(door));
    } else {
      Serial.println("{\"success\":false,\"reason\":\"INVALID_DOOR\",\"message\":\"Use um número de porta entre 1 e 4.\"}");
    }
  } else if (cmd.startsWith("lock ") || cmd.startsWith("LOCK ")) {
    int doorId = cmd.substring(5).toInt();
    Door* door = findDoorById(doorId);
    if (door != nullptr) {
      setDoorState(doorId, false, false);
      Serial.println(buildDoorActionJson(door));
    } else {
      Serial.println("{\"success\":false,\"reason\":\"INVALID_DOOR\",\"message\":\"Use um número de porta entre 1 e 4.\"}");
    }
  } else if (cmd.equalsIgnoreCase("help")) {
    printSerialHelp();
  } else {
    Serial.printf("[SERIAL] Comando desconhecido: '%s'. Digite 'help' para ver as opções.\n", cmd.c_str());
  }
}

// ============================================================================
// 13. Setup e Loop Principal
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println("\n============================================================");
  Serial.println("OpenCargo - Etapa 3: API Completa e Regras de Negócio (RAM)");
  Serial.println("============================================================");

  // Inicializa pinos das 4 fechaduras (LEDs)
  for (int i = 0; i < DOOR_COUNT; i++) {
    pinMode(doors[i].pin, OUTPUT);
    digitalWrite(doors[i].pin, LOW);
  }

  // Inicializa pino do sensor digital com pull-up interno
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  lastSensorState = isSensorTriggered();

  // Carrega os 4 usuários iniciais em memória RAM
  initDefaultUsers();
  addActivityLog("SISTEMA",
                 "Sistema",
                 "N/A",
                 0,
                 "-",
                 "INFO",
                 "Sistema iniciado com 4 usuários padrão carregados em RAM.");

  // Conecta ao Wi-Fi simulado do Wokwi
  Serial.printf("[WIFI] Conectando à rede '%s'...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);

  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }

  Serial.println("\n[WIFI] Conectado com sucesso!");
  Serial.print("[WIFI] Endereço IP do ESP32: ");
  Serial.println(WiFi.localIP());

  // Coleta cabeçalho personalizado caso o cliente envie X-Access-Code
  const char* headerKeys[] = { "X-Access-Code" };
  server.collectHeaders(headerKeys, 1);

  // Configura rotas do servidor HTTP
  server.on("/api/status", HTTP_GET, handleGetStatus);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);

  server.on("/api/login", HTTP_POST, handlePostLogin);
  server.on("/api/login", HTTP_OPTIONS, handleOptions);

  server.on("/api/access", HTTP_POST, handlePostAccess);
  server.on("/api/access", HTTP_OPTIONS, handleOptions);

  server.on("/api/users", HTTP_GET, handleGetUsers);
  server.on("/api/users", HTTP_POST, handlePostCreateUser);
  server.on("/api/users", HTTP_PUT, []() { handlePutUpdateUser(-1); });
  server.on("/api/users", HTTP_DELETE, []() { handleDeleteUser(-1); });
  server.on("/api/users", HTTP_OPTIONS, handleOptions);

  server.on("/api/logs", HTTP_GET, handleGetLogs);
  server.on("/api/logs", HTTP_OPTIONS, handleOptions);

  server.on("/api/sensor/ack", HTTP_POST, handlePostSensorAck);
  server.on("/api/sensor/ack", HTTP_OPTIONS, handleOptions);

  server.on("/api/doors/control", HTTP_POST, handlePostDoorControl);
  server.on("/api/doors/control", HTTP_OPTIONS, handleOptions);

  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("[HTTP] Servidor HTTP iniciado na porta 80.");
  Serial.println("[HTTP] Endpoints ativos:");
  Serial.println("  GET    /api/status");
  Serial.println("  POST   /api/login");
  Serial.println("  POST   /api/access");
  Serial.println("  GET    /api/users?adminCode=00000");
  Serial.println("  POST   /api/users");
  Serial.println("  PUT    /api/users/:id");
  Serial.println("  DELETE /api/users/:id");
  Serial.println("  GET    /api/logs?adminCode=00000");
  Serial.println("  POST   /api/sensor/ack");
  Serial.println("  POST   /api/doors/control");

  Serial.println("\n[STATUS INICIAL]");
  Serial.println(buildStatusJson());
  printSerialHelp();
}

void loop() {
  server.handleClient();
  updateDoorAutoLockTimers();
  monitorSensorChanges();
  handleSerialCommands();
  delay(10);
}

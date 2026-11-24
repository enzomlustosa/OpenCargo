# Checklist de Requisitos do Professor — OpenCargo

Este documento compara cada requisito obrigatório e entregável definidos pelo professor no [Projeto Integrador de IoT](https://github.com/WellingtonRoque/IoT/blob/main/Projeto/Projeto_Integrador_IoT.ipynb) com o que foi efetivamente implementado e comprovado no projeto **OpenCargo**.

---

## 1. Requisitos Obrigatórios do Notebook do Professor

| # | Requisito do Professor | Como foi Implementado no OpenCargo | Evidência Disponível | Estado |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **Simulador Wokwi + ESP32** | Circuito completo montado no Wokwi utilizando `wokwi-esp32-devkit-v1`, 4 LEDs com resistores de 220 Ω e 1 botão de sensor digital, acompanhado do firmware em C++ (`sketch.ino`). | [`firmware/diagram.json`](../firmware/diagram.json), [`firmware/sketch.ino`](../firmware/sketch.ino) e [`docs/screenshots/wokwi_4_leds_and_sensor.png`](./screenshots/wokwi_4_leds_and_sensor.png) | **Concluído** |
| **2** | **Biblioteca WiFi (`#include <WiFi.h>`) e WebServer** | O ESP32 utiliza `#include <WiFi.h>` e `#include <WebServer.h>` para conectar-se à rede `Wokwi-GUEST` (canal 6) e hospedar uma API HTTP JSON na porta 80 com suporte a CORS. | [`firmware/sketch.ino`](../firmware/sketch.ino) (linhas 1–3, 1277–1328) e log serial com IP `10.10.0.2` em [`docs/TESTING.md`](./TESTING.md) | **Concluído** |
| **3** | **Pelo menos 1 Sensor** | Implementado sensor digital no pino `GPIO 33` (`INPUT_PULLUP` com debounce de `40 ms`), representado por um botão que monitora a abertura física / violação de porta. | [`firmware/diagram.json`](../firmware/diagram.json) (`btnSensor`) e função `monitorSensorChanges()` em [`firmware/sketch.ino`](../firmware/sketch.ino) | **Concluído** |
| **4** | **Pelo menos 1 Atuador** | Implementados **4 atuadores (LEDs verdes)** nos pinos `GPIO 25, 26, 27 e 14`, representando as fechaduras das 4 portas industriais (`Porta 01 - Estoque`, `Porta 02 - Administração`, `Porta 03 - Produção`, `Porta 04 - Laboratório`). | [`firmware/diagram.json`](../firmware/diagram.json) (`led1` a `led4`) e [`docs/screenshots/wokwi_4_leds_and_sensor.png`](./screenshots/wokwi_4_leds_and_sensor.png) | **Concluído** |
| **5** | **Controle Automático (Atuador/Sistema responde ao Sensor e Temporização)** | 1) Quando o sensor `GPIO 33` detecta abertura física com as portas trancadas, o ESP32 ativa automaticamente o estado de alerta (`sensorAlertActive = true`) e grava o log `ALERTA`.<br>2) Toda porta destrancada é **trancada automaticamente** após `5000 ms` (`updateDoorAutoLockTimers()`). | [`firmware/sketch.ino`](../firmware/sketch.ino) (linhas 279–344) e [`docs/screenshots/wokwi_stage3_api_and_alert.png`](./screenshots/wokwi_stage3_api_and_alert.png) | **Concluído** |
| **6** | **Controle Manual pela Interface Web** | Botões **Destrancar** no Painel do Usuário (`/dashboard`), no modal de Acesso Avulso (`/access`) e na Visão Geral Administrativa (`/admin`), além do botão **Reconhecer** para redefinir alertas do sensor (`POST /api/sensor/ack`). | [`frontend/src/components/DoorTable.jsx`](../frontend/src/components/DoorTable.jsx) e [`docs/screenshots/frontend_user_dashboard.png`](./screenshots/frontend_user_dashboard.png) | **Concluído** |
| **7** | **Interface Web (Nome do sistema, Valor do sensor, Estado do atuador, Botões)** | Interface React + Vite + UnoCSS exibindo a marca **OpenCargo**, o estado do **Sensor de Porta (GPIO 33)** (`FECHADA` / `ABERTA` e status de violação), o estado das **4 fechaduras** (`Trancada` / `Destrancada (5s)`) e os botões de controle. | [`frontend/src/pages/DashboardPage.jsx`](../frontend/src/pages/DashboardPage.jsx) e [`docs/screenshots/frontend_user_dashboard.png`](./screenshots/frontend_user_dashboard.png) | **Concluído** |

---

## 2. Requisitos Funcionais e Arquiteturais do OpenCargo

| # | Requisito Específico do OpenCargo | Como foi Implementado | Evidência Disponível | Estado |
| :-: | :--- | :--- | :--- | :---: |
| **8** | **4 Usuários e Cargos Iniciais em RAM no ESP32** | Cadastrados em `initDefaultUsers()`: `Ana Souza` (`12345`, Funcionário), `Bruno Lima` (`23456`, Supervisor), `Carla Mendes` (`34567`, Gerente) e `Admin` (`00000`, Administrador). | [`firmware/sketch.ino`](../firmware/sketch.ino) (linhas 181–195) | **Concluído** |
| **9** | **Validação Exclusiva no Backend (ESP32)** | O frontend React não duplica regras de permissão; todas as operações chamam `/api/login`, `/api/access`, `/api/users` e `/api/logs`, onde o firmware valida códigos e cargos. | [`firmware/sketch.ino`](../firmware/sketch.ino) e [`frontend/src/services/api.js`](../frontend/src/services/api.js) | **Concluído** |
| **10** | **Fluxo de Acesso Avulso (`/access`) com Modal** | Página `/access` lista as 4 portas e abre `AccessCodeModal`, exibindo as mensagens exatas para código inexistente (`401`), falta de permissão (`403`) e acesso autorizado (`200`). | [`frontend/src/pages/AccessPage.jsx`](../frontend/src/pages/AccessPage.jsx) e [`docs/screenshots/frontend_single_access_modal.png`](./screenshots/frontend_single_access_modal.png) | **Concluído** |
| **11** | **Painel Administrativo (`/admin`) — CRUD de Usuários e Histórico em RAM** | Permite listar, criar, editar e excluir usuários em RAM (bloqueando a exclusão do Admin principal com `HTTP 403`) e consultar os últimos 50 logs com códigos mascarados (`***45`). | [`frontend/src/pages/AdminPage.jsx`](../frontend/src/pages/AdminPage.jsx) e [`docs/screenshots/frontend_admin_users.png`](./screenshots/frontend_admin_users.png) | **Concluído** |
| **12** | **Comunicação Direta Navegador (`localhost:5173`) → ESP32 no Wokwi (`localhost:8180`)** | Código cliente (`fetch` em `api.js`), CORS no `sketch.ino` e encaminhamento de porta em `firmware/wokwi.toml` implementados. No entanto, como o ambiente local utiliza apenas o Wokwi Web gratuito (sem `wokwigw` pago ou extensão VS Code com compilador local), a comunicação direta entre o navegador e o Wokwi não pôde ser executada nesta máquina; os dois lados foram validados separadamente (autoteste `HTTPClient` dentro do Wokwi + Simulador Local da API no navegador). | [`firmware/wokwi.toml`](../firmware/wokwi.toml), [`frontend/src/services/api.js`](../frontend/src/services/api.js) e seção 4 de [`docs/TESTING.md`](./TESTING.md) | **Parcial** *(Pendente de Gateway Local ou ESP32 Físico)* |

---

## 3. Entregáveis Exigidos pelo Professor

| Entregável | Localização no Projeto | Estado |
| :--- | :--- | :---: |
| **1. Projeto Wokwi (Circuito + Firmware)** | [`firmware/sketch.ino`](../firmware/sketch.ino), [`firmware/diagram.json`](../firmware/diagram.json), [`firmware/libraries.txt`](../firmware/libraries.txt) e [`firmware/wokwi.toml`](../firmware/wokwi.toml) *(prontos para uso e salvamento/compartilhamento em `https://wokwi.com/projects/new/esp32`)* | **Concluído** |
| **2. Código-fonte completo** | Pastas [`firmware/`](../firmware/) (ESP32 C++) e [`frontend/`](../frontend/) (React + Vite + UnoCSS) | **Concluído** |
| **3. Descrição do funcionamento** | Documentada em [`README.md`](../README.md), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md), [`docs/API.md`](./API.md), [`docs/TESTING.md`](./TESTING.md) e [`docs/PRESENTATION.md`](./PRESENTATION.md) | **Concluído** |

# Relatório de Testes e Validação — OpenCargo

Este documento registra todos os testes executados no projeto **OpenCargo**, diferenciando com transparência o que foi validado no **Simulador Wokwi**, o que foi validado no **Navegador Web (`http://localhost:5173`)** e o que depende de gateway externo ou hardware físico.

---

## 1. Visão Geral das Modalidades de Teste

| Modalidade | Ambiente Utilizado | O que foi Comprovado | Status |
| :--- | :--- | :--- | :---: |
| **A. Simulador Wokwi (ESP32 + Circuito)** | `https://wokwi.com/projects/new/esp32` executando [`firmware/sketch.ino`](../firmware/sketch.ino) e [`firmware/diagram.json`](../firmware/diagram.json) | Compilação C++, conexão `Wokwi-GUEST`, servidor HTTP na porta 80, requisições TCP/HTTP reais via `HTTPClient` interno, acionamento dos 4 LEDs, travamento automático em 5s, leitura do botão sensor `GPIO 33` e logs em RAM. | **Comprovado** |
| **B. Navegador Web (Frontend React)** | `http://localhost:5173` (Vite) com **Simulador Local da API do ESP32** e testes de tentativa de conexão em `http://localhost:8180` | Fluxos de Login dos 4 perfis, Painel do Usuário, Acesso Avulso com modal, Painel Administrativo (CRUD de usuários e histórico), proteção de rotas, tratamento de desconexão e reinício de memória RAM. | **Comprovado** |
| **C. Integração Direta Navegador → Wokwi ESP32** | Depende de túnel local (`wokwigw` pago do Wokwi Club), extensão Wokwi VS Code com compilador local ou ESP32 físico na LAN | Configurado no código (`VITE_ESP32_BASE_URL=http://localhost:8180` e [`firmware/wokwi.toml`](../firmware/wokwi.toml)), porém não executado nesta máquina por ausência do túnel/gateway local. | **Pendente de Gateway / Hardware** |

---

## 2. Testes Executados Diretamente no Simulador Wokwi

Evidências visuais:
- [`docs/screenshots/wokwi_4_leds_and_sensor.png`](./screenshots/wokwi_4_leds_and_sensor.png)
- [`docs/screenshots/wokwi_stage3_api_and_alert.png`](./screenshots/wokwi_stage3_api_and_alert.png)

No Wokwi, o comando `test` do Monitor Serial dispara uma tarefa FreeRTOS com `HTTPClient` que realiza requisições HTTP reais contra `http://127.0.0.1:80`:

| # | Cenário Testado no Wokwi | Requisição / Ação | Resultado Obtido |
| :-: | :--- | :--- | :--- |
| **W1** | Conexão Wi-Fi e Servidor HTTP | Boot do ESP32 (`setup()`) | Conectou à rede `Wokwi-GUEST` (IP `10.10.0.2`) e iniciou servidor HTTP na porta 80. |
| **W2** | Consulta de Status Inicial | `GET /api/status` | `HTTP 200` com `"stage": 3`, sensor `"FECHADA"` e as 4 portas com `"unlocked": false`. |
| **W3** | Login Válido e Inválido | `POST /api/login` (`12345` e `99999`) | `12345` retornou `HTTP 200` (`Ana Souza`, `Funcionário`); `99999` retornou `HTTP 401 (USER_NOT_FOUND)`. |
| **W4** | Destrancamento Autorizado e LEDs | `POST /api/access` (`12345` → Porta 01) e comando `unlock all` | `HTTP 200`, acendeu os LEDs verdes nos pinos `GPIO 25, 26, 27, 14` e iniciou contagem de `5000 ms`. |
| **W5** | Acesso Negado por Falta de Permissão | `POST /api/access` (`12345` → Porta 02) | `HTTP 403 (FORBIDDEN)` com mensagem de notificação à administração e registro no log. |
| **W6** | Acesso Negado por Código Inexistente | `POST /api/access` (`88888` → Porta 03) | `HTTP 401 (USER_NOT_FOUND)` e registro no log com código mascarado `***88 (Desconhecido)`. |
| **W7** | Proteção de Rota Administrativa | `GET /api/users?adminCode=12345` | `HTTP 403 (ADMIN_REQUIRED)` negando acesso ao usuário comum. |
| **W8** | CRUD Administrativo de Usuários | `POST /api/users`, `PUT /api/users/5`, `DELETE /api/users/5` (`adminCode=00000`) | Criou `Diego Rocha` (`HTTP 201`), atualizou para `Gerente` (`HTTP 200`) e excluiu da RAM (`HTTP 200`). |
| **W9** | Proteção do Administrador Principal | `DELETE /api/users/4?adminCode=00000` | `HTTP 403 (PROTECTED_ADMIN)` impedindo a exclusão do Admin principal. |
| **W10** | Travamento Automático (5 segundos) | Aguardar 5s após destrancamento + `GET /api/status` | O LED apagou automaticamente, a porta voltou a `"unlocked": false` e gerou o log `TRAVAMENTO_AUTO`. |
| **W11** | Sensor Físico e Alerta de Violação | Clique no botão vermelho `Sensor de Porta (GPIO 33)` com portas trancadas | Detectou transição `LOW` (`ABERTA`), ativou alerta e gravou o log `ALERTA -> Abertura física não autorizada detectada com portas trancadas!`. |
| **W12** | Consulta ao Histórico Completo | `GET /api/logs?adminCode=00000` | `HTTP 200` retornando todos os eventos com `relativeTime` e códigos mascarados (`***45`, `***00`). |

---

## 3. Testes Executados no Navegador (`http://localhost:5173`)

Evidências visuais:
- [`docs/screenshots/frontend_user_dashboard.png`](./screenshots/frontend_user_dashboard.png)
- [`docs/screenshots/frontend_single_access_modal.png`](./screenshots/frontend_single_access_modal.png)
- [`docs/screenshots/frontend_admin_users.png`](./screenshots/frontend_admin_users.png)

### 3.1 Testes dos Quatro Perfis e Autorização de Portas
| Perfil / Usuário | Código | Portas Habilitadas no Dashboard | Portas Bloqueadas (`Sem permissão`) | Acesso ao `/admin` | Resultado |
| :--- | :---: | :--- | :--- | :---: | :---: |
| **Funcionário** (`Ana Souza`) | `12345` | Porta 01 (Estoque), Porta 03 (Produção) | Porta 02 (Admin), Porta 04 (Lab) | Bloqueado (`HTTP 403`) | **Aprovado** |
| **Supervisor** (`Bruno Lima`) | `23456` | Porta 01, Porta 02, Porta 03 | Porta 04 (Laboratório) | Bloqueado (`HTTP 403`) | **Aprovado** |
| **Gerente** (`Carla Mendes`) | `34567` | Todas as 4 portas (01 a 04) | Nenhuma | Bloqueado (`HTTP 403`) | **Aprovado** |
| **Administrador** (`Admin`) | `00000` | Todas as 4 portas (01 a 04) | Nenhuma | **Liberado** | **Aprovado** |

### 3.2 Testes de Acesso Avulso (`/access`)
- **Código inexistente (`99999`):** Exibiu no modal `"Usuário não encontrado."`.
- **Usuário sem permissão (`12345` na Porta 02 — Administração):** Exibiu no modal `"Você não possui autorização para esta porta. A equipe de administração foi notificada."`.
- **Usuário autorizado (`23456` na Porta 02 — Administração):** Exibiu `"Acesso autorizado. Porta destrancada."`, mudou o status da Porta 02 na tabela para `Destrancada (5s)` e voltou para `Trancada` após 5 segundos.

### 3.3 Testes do Painel Administrativo (`/admin`)
- **Listagem de usuários:** Exibiu os 4 usuários iniciais vindos da API com código, cargo e badges das 4 portas.
- **Criação de usuário:** Cadastrado `Diego Rocha` (`45678`, `Funcionário`), elevando a lista para 5 usuários.
- **Edição de usuário e permissões:** Atualizado para `Diego Rocha Silva` (`Supervisor`) com todas as 4 portas habilitadas.
- **Exclusão de usuário com confirmação:** Excluído `Diego Rocha Silva` após confirmação no modal, retornando a lista para 4 usuários.
- **Tentativa de excluir o Administrador principal (`Admin`, ID #4):** Ao confirmar no modal, a API recusou a operação e exibiu o erro `"O administrador principal não pode ser excluído."`.
- **Histórico de atividades e Sensor:** Todos os logins, acessos, alterações administrativas e o acionamento do botão **Sensor GPIO 33** apareceram na aba **Histórico de atividades** com horário relativo e códigos mascarados.
- **Tentativa de acesso não autorizado ao `/admin`:** Ao entrar como `Ana Souza` (`12345`) e acessar `http://localhost:5173/admin` diretamente pela URL, a API negou com `HTTP 403` e o React exibiu a tela **"Acesso Administrativo Negado pelo ESP32"**.

### 3.4 Testes de Desconexão e Reinício da Memória RAM
- **Desconexão (`MODO: ESP32 REAL` sem gateway na porta `8180`):**
  - Ao selecionar **ESP32 Real (`http://localhost:8180`)** sem gateway local ativo, a requisição `GET http://localhost:8180/api/status` expira em 2 segundos sem travar a tela, exibindo o alerta vermelho **"ESP32 desconectado"**, desabilitando os botões de destrancamento e oferecendo os botões **"Tentar novamente"** e **"Usar Simulador Local"**.
- **Reinício da Memória RAM (`Reiniciar ESP32 (RAM)`):**
  - Após criar um 5º usuário temporário (`Teste Reboot`, `54321`) em memória RAM e acionar **Reiniciar ESP32 (RAM)**, o tempo ativo (`Uptime`) reiniciou em `00:00:01`, o histórico limpou os eventos antigos e a tabela de usuários restaurou imediatamente os 4 usuários padrão do firmware.

---

## 4. Testes Pendentes de Gateway ou Hardware Físico

- **Comunicação HTTP direta Navegador (`localhost:5173`) → ESP32 no Wokwi (`localhost:8180` / `localhost:9080`):**
  - **Motivo:** O ambiente atual utiliza o Wokwi Web gratuito (`Public IoT Gateway`), que não aceita conexões HTTP de entrada.
  - **Como realizar quando o ambiente dispuser de gateway ou hardware:**
    1. **Com ESP32 Físico:** Gravar [`firmware/sketch.ino`](../firmware/sketch.ino) na placa ESP32 configurando o SSID/senha do Wi-Fi local, copiar o IP impresso no Monitor Serial e informá-lo no botão **Conexão → ESP32 Real (HTTP)** do frontend.
    2. **Com Wokwi for VS Code:** Compilar o binário `.bin`/`.elf`, iniciar a simulação usando [`firmware/wokwi.toml`](../firmware/wokwi.toml) (que encaminha `localhost:8180` → `target:80`) e manter o frontend em `MODO: ESP32 REAL (http://localhost:8180)`.

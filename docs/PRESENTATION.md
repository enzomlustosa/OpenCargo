# Roteiro de Apresentação e Demonstração — OpenCargo (5 a 7 minutos)

Este roteiro foi preparado para uma apresentação prática, direta e natural em sala de aula ou laboratório.

---

## Preparação Antes de Começar (1 minuto antes da fala)

Deixe duas abas abertas lado a lado no navegador:
1. **Aba 1 — Simulador Wokwi:** `https://wokwi.com/projects/new/esp32` com o [`firmware/sketch.ino`](../firmware/sketch.ino) e [`firmware/diagram.json`](../firmware/diagram.json) carregados e a simulação iniciada (Monitor Serial visível).
2. **Aba 2 — Interface Web React:** `http://localhost:5173/` na tela inicial de Login (com o modo **Simulador Local (API ESP32)** ativo caso esteja usando o Wokwi Web gratuito).

---

## 1. Apresentação do Problema e Objetivo do OpenCargo (0:00 – 1:00)

**O que falar:**
> "Olá, professor e colegas. Meu nome é Enzo e este é o **OpenCargo**, nosso Projeto Integrador de IoT voltado para a **Indústria 4.0**.
> Em instalações industriais, setores como Estoque, Administração, Produção e Laboratório exigem controle rigoroso de quem pode destrancar cada porta e registro de qualquer tentativa de acesso ou violação física.
> O objetivo do OpenCargo foi construir um sistema IoT completo e simples de manter, no qual um **ESP32** gerencia quatro fechaduras simuladas por LEDs, monitora um sensor físico de porta e disponibiliza tudo em uma interface web em **React**."

---

## 2. Explicação da Arquitetura (1:00 – 1:45)

**O que mostrar:** Aponte rapidamente para o circuito no Wokwi e para a tela do React.

**O que falar:**
> "Nossa regra principal de arquitetura é: **o React cuida apenas da interface visual, enquanto o ESP32 cuida de toda a lógica, validação de permissões e controle do hardware**.
> Não usamos banco de dados externo nem servidor intermediário em Node ou Python. O próprio ESP32 hospeda um servidor HTTP na porta 80 respondendo em JSON. Os usuários, permissões e histórico de eventos ficam na memória RAM do ESP32."

---

## 3. Demonstração do Sensor, dos LEDs e da Automação no Wokwi (1:45 – 3:00)

**O que fazer na Aba 1 (Wokwi):**
1. No circuito do Wokwi, mostre os **4 LEDs verdes** (`GPIO 25, 26, 27 e 14`) representando as 4 portas e o **botão vermelho** (`GPIO 33`) representando o sensor magnético de porta.
2. Com todas as portas trancadas, **clique no botão vermelho (Sensor de Porta)** no Wokwi.
3. Mostre a linha de `ALERTA` que aparece instantaneamente no Monitor Serial.
4. Digite `test` no Monitor Serial do Wokwi e pressione Enter.

**O que falar:**
> "Aqui no Wokwi temos os 4 LEDs das portas e o botão vermelho no pino 33 simulando o sensor físico da porta.
> Reparem na **automação do sensor**: como as portas estão trancadas, quando eu pressiono o botão físico do sensor, o ESP32 detecta uma abertura não autorizada e dispara automaticamente um alerta de violação no log.
> E digitando `test` no Monitor Serial, o próprio ESP32 executa uma bateria de requisições HTTP na porta 80: ele autentica os 4 cargos, destranca os 4 LEDs verdes e, após **5 segundos**, o temporizador automático tranca todas as portas novamente e apaga os LEDs."

---

## 4. Login com Usuário Comum e Controle Manual (3:00 – 4:00)

**O que fazer na Aba 2 (React — `http://localhost:5173/`):**
1. Na tela de Login, digite o código da funcionária **Ana Souza**: `12345` e clique em **Entrar no Painel**.
2. Mostre no Dashboard que as portas **01 (Estoque)** e **03 (Produção)** aparecem como `Autorizado`, enquanto as portas **02 (Administração)** e **04 (Laboratório)** aparecem desabilitadas com `Sem permissão`.
3. Clique em **Destrancar** na **Porta 01 - Estoque**.

**O que falar:**
> "Agora na interface web, vou entrar com o código `12345`, da funcionária Ana Souza.
> O ESP32 retorna que ela tem cargo de Funcionário e permissão apenas para as Portas 01 e 03. As Portas 02 e 04 já aparecem bloqueadas.
> Quando clico em **Destrancar** na Porta 01, o comando vai para a API, a porta muda para **Destrancada** com a contagem regressiva de 5 segundos e, ao final dos 5 segundos, ela volta sozinha para o estado **Trancada**."

---

## 5. Tentativa de Acesso Não Autorizado via Acesso Avulso (4:00 – 4:45)

**O que fazer na Aba 2 (React):**
1. Clique em **Sair** no topo e depois em **Ir para Acesso avulso**.
2. Na linha da **Porta 02 - Administração**, clique em **Destrancar** para abrir o modal.
3. Digite o código da Ana Souza (`12345`) e clique em **Confirmar e Destrancar** (mostre o erro vermelho).
4. Agora digite o código do supervisor Bruno Lima (`23456`) e clique em **Confirmar e Destrancar** (mostre o sucesso verde).

**O que falar:**
> "Também temos o fluxo de **Acesso avulso**, para quando alguém quer abrir uma porta rapidamente sem iniciar sessão completa.
> Se a Ana Souza tentar abrir a Porta 02 da Administração com o código `12345`, o backend nega com HTTP 403 informando que ela não possui autorização e que a administração foi notificada.
> Já se o supervisor Bruno Lima informar o código `23456`, o acesso é autorizado e a porta destranca por 5 segundos."

---

## 6. Login Administrativo, Usuários e Histórico de Atividades (4:45 – 6:15)

**O que fazer na Aba 2 (React):**
1. Volte ao Login, entre com o código do Administrador: `00000` e clique em **Painel Administrativo**.
2. Mostre a aba **Visão geral** e depois clique na aba **Usuários**.
3. Cadastre rapidamente um usuário (ex.: Nome `Visitante Técnico`, Código `55555`, Cargo `Funcionário`, marcando a Porta 01) e clique em **Cadastrar Usuário**.
4. Clique em **Excluir** na linha do `Admin` principal e confirme no modal para mostrar que o firmware bloqueia a exclusão (`"O administrador principal não pode ser excluído."`).
5. Clique na aba **Histórico de atividades** e clique no botão **Sensor GPIO 33: FECHADA (Alternar)** na barra superior para mostrar o evento `ALERTA` aparecendo no topo do histórico.

**O que falar:**
> "Por fim, entrando com o código `00000` do Administrador, acessamos o **Painel Administrativo**.
> Na aba **Usuários**, podemos cadastrar novos funcionários, editar permissões por porta e excluir usuários em memória RAM. Reparem que, se tentarmos excluir o Administrador principal, o próprio backend bloqueia a operação para evitar que o sistema fique sem administrador.
> E na aba **Histórico de atividades**, o administrador acompanha todos os eventos com horário relativo de execução e códigos parcialmente mascarados por segurança: logins, acessos autorizados, tentativas negadas, travamentos automáticos de 5 segundos e alertas de violação do sensor físico."

---

## 7. Encerramento (6:15 – 6:45)

**O que falar:**
> "Com isso, o OpenCargo cumpre todo o ciclo exigido no Projeto Integrador de IoT: leitura de sensor digital, processamento e regras de negócio no ESP32, atuadores com controle manual pela interface web e controle automático tanto por temporização quanto por resposta ao sensor. Obrigado! Estou à disposição para perguntas."

# 🏁 FTR PITWALL — Guia Rápido da Equipe (LMU)

Resumo direto das funcionalidades do app para planejamento e acompanhamento ao vivo de corridas de endurance no **Le Mans Ultimate**.

---

## 🔐 1. Sala Ao Vivo & Multi-Carros
- **Acesso por PIN:** todos da equipe entram na mesma sala e editam em tempo real (com contador de membros online).
- **Até 3 Carros Simultâneos:** cada carro tem seu próprio número, categoria, modelo, parâmetros e escala de pilotos.
- **Copiar Estratégia:** copia parâmetros e stints de um carro para outro (sem copiar os nomes dos pilotos).
- **Filtro de Pilotos por Carro:** cadastre quem corre em cada carro para limpar a lista nos stints.

---

## ⚙️ 2. Parâmetros de Corrida & Autonomia
- **Campeonato (`WEC` ou `ELMS`):** no `WEC` usa Combustível + Energia Virtual; na `ELMS` usa só Combustível.
- **Campos de Tempo Separados:** Início da Sessão (`H` | `M`), Duração (`H` | `M`) e Tempo de Volta (`Min` | `Seg` | `Ms`).
- **Fuel Ratio & Autonomia:** calcula automaticamente quantas voltas e minutos cada stint dura e o fator limitante (Tanque ou Energia).
- **Voltas `Min` / `Safe` + Relógio Últ. Volta:** mostra se precisa de volta extra de segurança na bandeirada.
- **Chavinha `🔥 Agressivo | 🌿 Econômico` (Tank Maximizer):** alterna em 1 clique entre ritmo máximo e economia de `+1 volta/stint` (mostrando se elimina algum pitstop).

---

## ⏱️ 3. Modo Plano vs. Modo Corrida
- **Modo Plano:** monte a escala de pilotos (até 6 por sessão), escolha cenários de pit e planeje reaproveitamento de pneus sem afetar o ao vivo.
- **Exportar para Corrida:** envia o planejamento fechado para a aba **Modo Corrida**.
- **Modo Corrida (Ao Vivo):**
  - Ajuste duração real de stints em imprevistos (safety car, acidente, splash).
  - Marque stints e paradas concluídas com o **check quadriculado**.
  - Registre o desgaste real (**Pneus Fim**) de cada stint.

---

## 🔧 4. Pitstops Inteligentes
- **7 Cenários Prontos:** `2 Pneus`, `4 Pneus`, `Combustível`, `Troca Piloto` e combinações.
- **Cálculo Realista do LMU:** mangueira (`2,5%/s` ou `2,5 L/s + 3s`), troca de piloto em paralelo (`25s`), troca de pneus sequencial (`8,5s` GT / `8,0s` Protótipos) e *pitlane loss*.
- **Alvo Exato no MFD:** mostra quanto abastecer em cada parada (`100%` nos stints intermediários e apenas a fração final no último stint).

---

## 🛞 5. Gerenciador & Calculadora de Pneus
- **Controle de Estoque:** conta pneus secos usados vs. disponíveis (pneus de chuva `💧` são ilimitados).
- **Troca Automática:** escolher `4 Pneus` já coloca 4 pneus `NOVOS (100%)` no próximo stint; escolher sem troca já coloca `MANTER`.
- **Reaproveitamento (`USADO`):** banco automático com ranking dos melhores pneus usados por canto (`FL`, `FR`, `RL`, `RR`) nos modos Plano e Corrida.
- **Calculadora de Desgaste (Regra de 3):** informe voltas + `%` restante e descubra o desgaste/volta exato do treino/corrida.
- **Cabeçalho Dinâmico:** alterna a cada 5s entre o melhor pneu usado disponível e o desgaste/volta.

---

## 📅 6. Calendário & Compartilhamento
- **Calendário LMU:** próximas etapas oficiais com traçado SVG da pista e pré-cadastro de pilotos.
- **Resumo WhatsApp:** botão que copia toda a estratégia (horários, pilotos, alvos de pit e pneus) pronta para colar no grupo da equipe.
- **PWA (Celular):** pode ser instalado na tela inicial do Android/iOS como aplicativo.

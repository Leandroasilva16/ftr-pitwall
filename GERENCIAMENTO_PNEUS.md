# Gerenciamento de Pneus — FTR PITWALL (LMU)

Guia completo sobre alocação, desgaste, reaproveitamento e regras de pneus implementadas em [`src/App.jsx`](src/App.jsx).

---

## 1. Alocação e Contagem de Pneus Secos

- **Pneus Disponíveis (`availableTires`):** quantidade total de pneus **secos** permitida para o carro no evento (padrão inicial: `24`; padrão no reset: `32`).
- **Pneus de Chuva (`💧`):** são **ilimitados** e nunca entram na contagem de estoque de pneus secos.
- **Pneus Usados (`usedTiresCount`):** contabiliza quantos pneus secos já foram consumidos até o momento (liberado tanto no **Modo Plano** quanto no **Modo Corrida**), exibido no cabeçalho como `usados / disponíveis` (ex.: `12/32`).
  - Pneus marcados como **`NOVO` (`100%`)** consomem unidades do estoque.
  - Pneus marcados como **`MANTER` (`keep`)** ou **`USADO`** (reaproveitado do banco de pneus) **não** consomem novos pneus do estoque.

---

## 2. Estados de Pneus por Canto (`FL`, `FR`, `RL`, `RR`)

Cada sessão (`Qualy` e cada `Stint` de corrida) controla os 4 cantos separadamente:
- **`FL`** — Dianteiro Esquerdo (*Front Left*)
- **`FR`** — Dianteiro Direito (*Front Right*)
- **`RL`** — Traseiro Esquerdo (*Rear Left*)
- **`RR`** — Traseiro Direito (*Rear Right*)

Os valores possíveis de entrada (`tiresStart`) para cada canto são:
1. **`NOVO` (`100%`):** pneu zero km retirado da alocação.
2. **`MANTER` (`keep`):** mantém o mesmo pneu que terminou o stint anterior.
3. **`USADO` (ID do banco):** reaproveita um pneu que foi retirado em uma sessão/stint anterior.
4. **`CHUVA` (`wet`):** pneu de pista molhada (`💧`), sem consumo do estoque seco.

---

## 3. Regra de Troca Automática pelo Cenário de Pitstop

Ao selecionar o cenário de pitstop ao final do `Stint i`:
- **Troca de 4 pneus (`4_tires_fuel` / `4_tires_swap_fuel`):** preenche automaticamente os 4 cantos do `Stint i + 1` com **4 pneus novos (`100%`)**.
- **Sem troca de pneus (`fuel_only` / `swap_fuel` / `driver_swap_only`):** preenche automaticamente os 4 cantos do `Stint i + 1` com **`MANTER` (`keep`)**.
- **Troca de 2 pneus (`2_tires_fuel` / `2_tires_swap_fuel`):** permite escolher manualmente quais 2 cantos recebem pneus novos e quais 2 permanecem com `keep` ou `USADO`.

---

## 4. Desgaste Estimado e Calculadora por Regra de 3

### Desgaste por Volta (`tireWearPerLapPct`)
Cada canto possui uma taxa estimada de desgaste por volta em `%` (padrão no reset: **`1%`** para `FL`, `FR`, `RL` e `RR`).
- Durante o planejamento e projeções, o **Pneu Fim Estimado** é calculado a partir do pneu inicial menos `voltas × desgastePorVolta`.
- No **Modo Corrida**, ao ativar e preencher os valores reais de **`Pneus Fim`**, o sistema passa a usar o desgaste real aferido na pista.

### Calculadora de Desgaste de Pneus
Permite descobrir o desgaste real por volta usando uma **regra de 3** simples a partir de qualquer stint de treino ou corrida:
- Informe a **quantidade de voltas** percorridas e a **vida restante (%)** de cada pneu (`FL`, `FR`, `RL`, `RR`).
- Fórmula aplicada por canto:
  $$\text{Desgaste/Volta (\%)} = \frac{100 - \text{Vida Restante (\%)}}{\text{Voltas}}$$
- Com um clique, os valores calculados são aplicados diretamente nos parâmetros do carro.

---

## 5. Cabeçalho Dinâmico (Alternância a cada 5 segundos)

No cabeçalho principal da aplicação, o indicador de pneus alterna automaticamente a cada **5 segundos** entre duas visões rápidas:
1. **Melhor Pneu Usado (`FL / FR / RL / RR`):** mostra o pneu reaproveitável com maior vida restante (%) disponível no banco de cada canto.
2. **Desgaste Estimado por Volta:** mostra a taxa de `% / volta` configurada para `FL`, `FR`, `RL` e `RR`.

---

## 6. Gerenciador de Reaproveitamento de Pneus (Banco e Ranking)

Disponível tanto no **Modo Plano** quanto no **Modo Corrida**:
- Sempre que um stint troca de pneu (ou seja, o pneu não continua via `MANTER`), o conjunto retirado entra automaticamente no **Banco de Pneus Usados** com sua porcentagem final e identificador único.
- O modal **Melhores Pneus para Reaproveitar** lista todos os pneus disponíveis por canto ordenados da **maior para a menor vida útil (%)**, destacando a opção **SUGERIDO** para facilitar a escolha em stints de 2 ou 4 pneus usados.

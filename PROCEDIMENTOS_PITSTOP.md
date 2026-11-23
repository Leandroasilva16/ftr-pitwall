# Procedimentos de Pitstop — FTR PITWALL (LMU)

Guia explicativo de como o **FTR PITWALL** calcula os procedimentos, tempos de parada e alvos de MFD para o **Le Mans Ultimate (LMU)** em [`src/App.jsx`](src/App.jsx).

---

## 1. Os 7 Cenários de Pitstop (`PIT_SCENARIOS`)

Ao final de cada stint (exceto o último da corrida), é possível escolher o procedimento da parada:

| ID do Cenário | Descrição | Pneus Trocados | Troca de Piloto | Reabastecimento |
| :--- | :--- | :---: | :---: | :---: |
| `4_tires_fuel` | 4 Pneus + Combustível | `4` | Automática se mudar o piloto no próximo stint | Sim |
| `2_tires_fuel` | 2 Pneus + Combustível | `2` | Automática se mudar o piloto no próximo stint | Sim |
| `fuel_only` | Combustível | `0` | Automática se mudar o piloto no próximo stint | Sim |
| `4_tires_swap_fuel` | 4 Pneus + Troca Piloto + Combustível | `4` | Forçada (`25s` em paralelo) | Sim |
| `2_tires_swap_fuel` | 2 Pneus + Troca Piloto + Combustível | `2` | Forçada (`25s` em paralelo) | Sim |
| `swap_fuel` | Troca Piloto + Combustível | `0` | Forçada (`25s` em paralelo) | Sim |
| `driver_swap_only` | Troca Piloto | `0` | Forçada (`25s`) | Não (`0s`) |

> **Observação:** Sempre que o piloto definido para o `Stint i + 1` for diferente do piloto do `Stint i` (e ambos forem diferentes de `ND`), a troca de piloto é ativada automaticamente na parada mesmo nos cenários sem `_swap_`.

---

## 2. Estratégia de Abastecimento: Tanque Cheio vs. Último Stint

O sistema distingue paradas intermediárias da parada para o stint final:

- **Stints Intermediários (`fillToMax = true`):**
  - Planejados para abastecer até **100% da Energia Virtual** (no modo `WEC`) ou **100% do tanque em litros** (no modo `ELMS`), garantindo stints completos no limite máximo do carro.
- **Último Stint (`fillToMax = false`):**
  - Calcula exatamente as voltas restantes até a bandeirada (`baseNextLaps = Math.ceil((rawNextMin * 60) / lapTimeSec)`) e adiciona **`+1` volta** de margem de segurança (*splash/formation*).
  - Desconta o combustível/energia restante no carro ao entrar no box (`remainingFuelL` / `remainingEnergyPct`) para definir o alvo exato no MFD sem desperdiçar tempo na mangueira.

---

## 3. Como é Calculado o Tempo Total da Parada (`calculatePitStopDetails`)

A simulação segue a ordem física real dos boxes no **LMU**:

### Etapa 1 — Mangueira de Combustível / Energia Virtual (`refuelSec`)
- **WEC:**
  $$\text{refuelSec} = \frac{\Delta\text{Energia (\%)}}{2.5} + 3\text{s}$$
- **ELMS:**
  $$\text{refuelSec} = \frac{\Delta\text{Litros (L)}}{2.5} + 3\text{s}$$
- Os **3 segundos fixos** representam o acoplamento, desacoplamento da mangueira e acionamento dos *air jacks*. Se não houver reabastecimento (`delta <= 0` ou `driver_swap_only`), `refuelSec = 0`.

### Etapa 2 — Troca de Piloto em Paralelo (`baseWithSwapSec`)
- No LMU, a troca de piloto ocorre **simultaneamente** ao reabastecimento e dura **25 segundos**.
- Se houver troca de piloto (`swapActive`), aplica-se:
  $$\text{baseWithSwapSec} = \max(\text{refuelSec},\ 25\text{s})$$

### Etapa 3 — Troca Sequencial de Pneus (`tireSec`)
- Os mecânicos só iniciam a troca de pneus **após** desconectar a mangueira, um pneu por vez:
  - **LMGT3 / GTE:** `8,5s` por pneu (`34s` para 4 pneus, `17s` para 2 pneus).
  - **Hypercar / LMP2 / LMP3:** `8,0s` por pneu (`32s` para 4 pneus, `16s` para 2 pneus).

### Etapa 4 — Tempo Parado e Pitlane Loss (`stationarySec` e `totalSec`)
- **Tempo parado no box:** $\text{stationarySec} = \text{baseWithSwapSec} + \text{tireSec}$
- **Tempo total de parada:** $\text{totalSec} = \text{stationarySec} + \text{pitlaneLossSec}$
- O `totalSec` é descontado do tempo restante de corrida para calcular o horário exato de saída e a duração do `Stint i + 1` (convergência em 2 passos).

---

## 4. Alvo Exibido para o Piloto no MFD (`mfdTargetLabel`)

Cada linha de pitstop exibe de forma compacta o valor que o piloto deve deixar ajustado no MFD antes de entrar no box:
- **WEC:** `XX% E (YYL)` (ex.: `100% E (90L)` nos stints cheios, ou a fração exata no último stint).
- **ELMS:** `YYL` (apenas litros).
- **Sem abastecimento:** `Sem abastec.` (quando `driver_swap_only` ou saldo já suficiente).

---

## 5. Ações Automáticas nos Pneus do Próximo Stint

Ao alterar o cenário de pitstop do `Stint i`, o próximo stint (`Stint i + 1`) é atualizado automaticamente:
- **Cenários de 4 pneus (`4_tires_fuel` / `4_tires_swap_fuel`):** define os 4 cantos do próximo stint como **NOVO (`100%`)**.
- **Cenários sem troca de pneus (`fuel_only` / `swap_fuel` / `driver_swap_only`):** define os 4 cantos do próximo stint como **MANTER (`keep`)**.

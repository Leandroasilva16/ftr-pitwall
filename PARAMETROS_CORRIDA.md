# Parâmetros de Corrida — FTR PITWALL (LMU)

Documentação completa dos parâmetros globais de evento, parâmetros individuais por carro e regras de cálculo de autonomia, *Fuel Ratio* e pitstop implementadas em `src/App.jsx`.

---

## 1. Campeonatos Disponíveis (`championship`)

Configuração global compartilhada entre todos os carros da equipe no evento:

| Campeonato | Regra Aplicada |
| :--- | :--- |
| **`WEC`** *(padrão)* | Utiliza **Combustível (Litros)** + **Energia Virtual (%)**. A autonomia do stint é limitada pelo recurso que acabar primeiro e o painel calcula o **Fuel Ratio** ideal. |
| **`ELMS`** | **Sem Energia Virtual** (os campos de Energia Virtual e Fuel Ratio são ocultados automaticamente). A autonomia depende exclusivamente da capacidade do tanque em litros. |

---

## 2. Categorias Disponíveis (`carClass`)

- **`Hypercar`**
- **`LMP2`**
- **`LMP3`**
- **`LMGT3`** *(padrão)*
- **`GTE`**

---

## 3. Carros Disponíveis (`carId`)

### Hypercar (13 modelos)
- Alpine A424 (`alpine-a424`)
- Aston Martin Valkyrie AMR-LMH (`aston-valkyrie`)
- BMW M Hybrid V8 (`bmw-m-hybrid-v8`)
- Cadillac V-Series.R (`cadillac-v-series-r`)
- Ferrari 499P (`ferrari-499p`)
- Genesis GMR-001 (`genesis-gmr-001`)
- Glickenhaus SCG 007 (`glickenhaus-007`)
- Isotta Fraschini Tipo 6 LMH-C (`isotta-tipo6`)
- Lamborghini SC63 (`lamborghini-sc63`)
- Peugeot 9X8 (`peugeot-9x8`)
- Porsche 963 (`porsche-963`)
- Toyota GR010 Hybrid (`toyota-gr010`)
- Vanwall Vandervell 680 (`vanwall-680`)

### LMP2 (1 modelo)
- Oreca 07 - Gibson (`oreca-07`)

### LMP3 (4 modelos)
- ADESS AD25 / ADESS-03 Evo (`adess-ad25`)
- Duqueine D09 (`duqueine-d09`)
- Ginetta G61-LT-P3 Evo (`ginetta-g61`)
- Ligier JS P325 (`ligier-jsp325`)

### LMGT3 (10 modelos)
- Aston Martin Vantage AMR LMGT3 (`aston-vantage-lmgt3`)
- BMW M4 LMGT3 (`bmw-m4-lmgt3`)
- Chevrolet Corvette Z06 LMGT3.R (`corvette-z06-lmgt3`)
- Ferrari 296 LMGT3 (`ferrari-296-lmgt3`)
- Ford Mustang LMGT3 (`ford-mustang-lmgt3`)
- Lamborghini Huracán LMGT3 Evo2 (`lamborghini-huracan-lmgt3`)
- Lexus RC F LMGT3 (`lexus-rcf-lmgt3`)
- McLaren 720S LMGT3 Evo (`mclaren-720s-lmgt3`)
- Mercedes-AMG LMGT3 (`mercedes-amg-lmgt3`)
- Porsche 911 GT3 R (992) LMGT3 (`porsche-911-lmgt3`) *(padrão)*

### GTE (4 modelos)
- Aston Martin Vantage AMR GTE (`aston-vantage-gte`)
- Chevrolet Corvette C8.R (`corvette-c8r-gte`)
- Ferrari 488 GTE Evo (`ferrari-488-gte`)
- Porsche 911 RSR-19 (`porsche-911-rsr-gte`)

---

## 4. Pistas Disponíveis (`circuitId`)

Total de **20 circuitos** mapeados com traçado vetorial 2D:

1. **Autodromo Internazionale Enzo e Dino Ferrari (Imola)** — Itália (`imola`)
2. **Autódromo Internacional do Algarve (Portimão)** — Portugal (`portimao`)
3. **Autódromo José Carlos Pace (Interlagos)** — Brasil (`interlagos`)
4. **Autodromo Nazionale Monza** — Itália (`monza`)
5. **Bahrain International Circuit** — Bahrein (`bahrain`)
6. **Circuit de Barcelona-Catalunya** — Espanha (`barcelona`)
7. **Circuit de la Sarthe (Le Mans)** — França (`lemans`)
8. **Circuit de Spa-Francorchamps** — Bélgica (`spa`)
9. **Circuit of the Americas (COTA)** — EUA (`cota`)
10. **Circuit Paul Ricard** — França (`paul-ricard`)
11. **Daytona International Speedway** — Daytona, Flórida, EUA (`daytona`)
12. **Fuji Speedway** — Japão (`fuji`)
13. **Indianapolis Motor Speedway (Road Course)** — Speedway, Indiana, EUA (`indianapolis`)
14. **Lusail International Circuit (Qatar)** — Catar (`lusail`)
15. **Michelin Raceway Road Atlanta** — Braselton, Georgia, EUA (`road-atlanta`)
16. **Sebring International Raceway** — EUA (`sebring`)
17. **Silverstone Circuit** — Reino Unido (`silverstone`)
18. **Long Beach Grand Prix Circuit** — Long Beach, Califórnia, EUA (`long-beach`)
19. **Watkins Glen International** — Watkins Glen, Nova York, EUA (`watkins-glen`)
20. **WeatherTech Raceway Laguna Seca** — Monterey, Califórnia, EUA (`laguna-seca`)

---

## 5. Formatos e Limites dos Campos

| Parâmetro | Escopo | Formato / Tipo | Padrão | Regras / Observações |
| :--- | :--- | :--- | :--- | :--- |
| **Início da Sessão** (`sessionStart`) | Evento | `HH:MM` (24h, `<input type="time">`) | `14:00` | Define o horário inicial do **Free Practice**, seguido por **Qualy** e **Corrida** (`wrap` de 24h). |
| **Duração Corrida** (`raceDurationStr`) | Evento | `HH:MM` (ex.: `06:00`, `24:00`) | `06:00` | Ao sair do campo (`onBlur`/`Enter`), normaliza para `HH:MM` (mínimo `00:10`). Também aceita dígitos compactos (ex.: `6` → `06:00`, `0130` → `01:30`). |
| **Tempo de Volta** (`lapTimeStr`) | Carro | `MM:SS.mmm` (ex.: `01:45.320`) | `01:45.320` | Aceita `.` ou `,` para milissegundos, `MM:SS` ou segundos puros (`> 5s`). Normaliza para `MM:SS.mmm` no `onBlur`/`Enter`. |
| **Tanque (Litros)** (`tankCapacityL`) | Carro | Inteiro (`>= 1`) | `100` | Capacidade total do tanque de combustível do carro em litros. |
| **Consumo (L/volta)** (`fuelPerLapL`) | Carro | Decimal (`>= 0.1`, aceita `,` ou `.`) | `3.1` | Consumo médio de combustível por volta em litros. |
| **Energia Virt. (%/v)** (`virtualEnergyPerLapPct`) | Carro *(apenas WEC)* | Decimal (`>= 0.1`, aceita `,` ou `.`) | `2.1` | Consumo médio de Energia Virtual por volta em `%`. Oculto no regulamento `ELMS`. |
| **Free Practice (min)** (`fpDurationMin`) | Evento | Inteiro em minutos (`>= 0`) | `5` | Duração da sessão de treino livre antes do Qualy. Voltas estimadas: `Math.floor((fpDurationMin * 60) / lapTimeSec)`. |
| **Qualy (min)** (`qualyDurationMin`) | Evento | Inteiro em minutos (`>= 0`) | `15` | Duração da classificação antes da largada. Voltas estimadas: `Math.floor((qualyDurationMin * 60) / lapTimeSec)`. |
| **Pneus Disponíveis** (`availableTires`) | Carro | Inteiro (`>= 0`) | `24` | Quantidade total de pneus **secos** disponíveis para o carro. Pneus de **chuva (`💧`)** são ilimitados e não entram nessa contagem. |
| **Passagem pelo Pitlane** (`pitlaneLossSec`) | Carro | Inteiro em segundos (`>= 0`) | `30` | Tempo perdido apenas percorrendo o pitlane (entrada + saída em velocidade limitada), separado do tempo parado no box. |

---

## 6. Como é Feito o Cálculo do Pitlane e Pitstop (LMU)

Cada parada ao final do `Stint i` é calculada olhando para a **demanda real do próximo stint (`Stint i + 1`)**, usando convergência em 2 passos para alinhar a duração do pitstop com o tempo restante de corrida:

### Passo 1 — Demanda de Voltas do Próximo Stint
- Calcula-se a duração projetada do próximo stint (`rawNextMin`) com base no tempo restante de prova (respeitando overrides manuais caso existam).
- `baseNextLaps = Math.ceil((rawNextMin * 60) / lapTimeSec)`
- Se o próximo stint for o **último stint da corrida**, adiciona-se **`+1` volta** de margem de segurança (*splash/formation*).

### Passo 2 — Volume / Energia a Abastecer (`delta`)
Desconta-se o saldo restante estimado ao entrar no box (`remainingFuelL` e, no WEC, `remainingEnergyPct`):
- **Modo WEC:**
  - `neededEnergyPct = Math.min(100, nextStintLaps * energyPerLap)`
  - `deltaEnergyPct = Math.max(0, neededEnergyPct - remainingEnergyPct)`
  - `neededLiters = Math.min(tankL, nextStintLaps * fuelPerLap)`
  - `deltaLiters = Math.max(0, neededLiters - remainingFuelL)`
- **Modo ELMS:**
  - `neededLiters = Math.min(tankL, nextStintLaps * fuelPerLap)`
  - `deltaLiters = Math.max(0, neededLiters - remainingFuelL)`
- Se o cenário for **`driver_swap_only`** (*Somente troca de piloto*), o reabastecimento é `0`.

### Passo 3 — Tempo Parado no Box (`stationarySec`)
1. **Tempo de Mangueira (`refuelSec`):**
   - **WEC:** `deltaEnergyPct > 0 ? (deltaEnergyPct / 2.5 + 3) : 0` *(vazão de 2,5%/s + 3s de acoplamento/desacoplamento e air jacks)*
   - **ELMS:** `deltaLiters > 0 ? (deltaLiters / 2.5 + 3) : 0` *(vazão de 2,5 L/s + 3s fixos)*
2. **Troca de Piloto em Paralelo:**
   - Ocorre simultaneamente ao reabastecimento e leva **25s** (ativada quando há troca de piloto entre `Stint i` e `Stint i + 1`, ou no cenário `driver_swap_only`).
   - `baseWithSwapSec = swapActive ? Math.max(refuelSec, 25) : refuelSec`
3. **Troca Sequencial de Pneus (`tireSec`):**
   - No LMU, os pneus só são trocados **após** a desconexão da mangueira, um por vez:
     - **4 pneus (`4_tires_fuel`):** `4 × tempoPorPneu`
     - **2 pneus (`2_tires_fuel`):** `2 × tempoPorPneu`
     - **0 pneus (`fuel_only` / `driver_swap_only`):** `0s`
   - `tempoPorPneu`: **`8,5s`** para `LMGT3` / `GTE` e **`8,0s`** para `Hypercar` / `LMP2` / `LMP3`.
4. **Tempo Parado Total:**
   - `stationarySec = baseWithSwapSec + tireSec`

### Passo 4 — Tempo Total com Pitlane Loss (`totalSec`)
- `totalSec = stationarySec + pitlaneLossSec`
- Esse tempo total (`totalSec / 60` minutos) avança o relógio de início do `Stint i + 1` e é descontado do cronômetro restante da corrida.

---

## 7. Como é Feito o Cálculo de *Fuel Ratio* e Autonomia Máxima

Calculado em `computeCarTelemetry(eventConfig, carParams)`:

1. **Fuel Ratio** *(apenas no modo `WEC`)*:
   $$\text{Fuel Ratio} = \frac{\text{Consumo (L/volta)}}{\text{Energia Virtual (\%/volta)}}$$
   - No modo **`ELMS`**, o *Fuel Ratio* não se aplica (`null`) e é ocultado da interface.

2. **Autonomia por Combustível (Litros):**
   $$\text{maxLapsByFuel} = \left\lfloor \frac{\text{Tanque (L)}}{\text{Consumo (L/volta)}} \right\rfloor$$

3. **Autonomia por Energia Virtual** *(apenas no modo `WEC`)*:
   $$\text{maxLapsByEnergy} = \left\lfloor \frac{100}{\text{Energia Virtual (\%/volta)}} \right\rfloor$$

4. **Autonomia Máxima do Stint e Fator Limitante:**
   - **WEC:** `maxStintLaps = Math.max(1, Math.min(maxLapsByFuel, maxLapsByEnergy))`
     - Fator limitante: **`Tanque`** se `maxLapsByFuel <= maxLapsByEnergy`, caso contrário **`Energia Virtual`**.
   - **ELMS:** `maxStintLaps = Math.max(1, maxLapsByFuel)`
     - Fator limitante: **`Tanque (ELMS)`**.

5. **Duração Máxima do Stint (minutos):**
   $$\text{maxStintMin} = \frac{\text{maxStintLaps} \times \text{lapTimeSec}}{60}$$

# 🏁 FTR PITWALL — Engenharia de Corrida (Faster Team Racing)

Aplicação web (Desktop e Mobile/PWA) desenvolvida para planejamento estratégico e acompanhamento ao vivo de corridas de endurance no **Le Mans Ultimate (LMU)**.

---

## ✨ Principais Funcionalidades

- **Acesso por PIN (Sala Ao Vivo):** bloqueio de visualização/edição até informar o PIN da equipe, com sincronização em tempo real e contador de membros conectados via **Supabase Realtime**.
- **Multi-Carros & Escalação por Carro:** suporte a até 3 carros simultâneos com parâmetros independentes, cópia de estratégia (sem copiar pilotos) e seleção dos pilotos escalados para cada carro.
- **Modo Plano vs. Modo Corrida:**
  - **Plano:** definição livre da escala de pilotos (limite de 6 pilotos por sessão, com opção `ND` fora da contagem), estratégia de pitstop entre stints (7 cenários) e escolha/reaproveitamento livre de pneus (`NOVO`, `MANTER`, `USADO`).
  - **Corrida:** importação manual do planejamento (`Exportar Planejamento para Corrida`), edição de duração de stints em caso de imprevistos, registro individual de desgaste de pneus (`Pneus Fim`) e marcação quadriculada de stints/pits concluídos.
- **Fuel Ratio, Autonomia & Tank Maximizer:** cálculo automático de autonomia máxima por tanque e energia virtual, abastecimento máximo nos stints intermediários, chavinha **🔥 Agressivo | 🌿 Econômico** (`+1 volta/stint`), cálculo de voltas `Min / Safe` e **Relógio na Última Volta**.
- **Gerenciador e Calculadora de Pneus:** contagem de pneus usados no cabeçalho (alternando a cada 5s entre melhor pneu usado e desgaste/volta), calculadora de desgaste por regra de 3 e modal de ranking para reaproveitamento.
- **Documentação Técnica:**
  - [PARAMETROS_CORRIDA.md](PARAMETROS_CORRIDA.md) — Parâmetros de evento/carro, fórmulas de autonomia e Tank Maximizer.
  - [PROCEDIMENTOS_PITSTOP.md](PROCEDIMENTOS_PITSTOP.md) — Procedimentos de pitstop, cenários e alvos no MFD.
  - [GERENCIAMENTO_PNEUS.md](GERENCIAMENTO_PNEUS.md) — Estoque, desgaste, reaproveitamento e trocas automáticas de pneus.
- **Calendário LMU com Pré-Cadastro:** eventos oficiais com bandeira do país, traçado SVG dos circuitos, pré-cadastro de pilotos por etapa e links diretos para o [LMU Schedule](https://www.lmuschedule.com/) e [Special Event / Beginner](https://www.lmuschedule.com/special-event/beginner) (atualizado semanalmente).
- **Resumo para WhatsApp & PWA:** geração rápida de resumo formatado para o grupo da equipe e instalação como aplicativo no celular (Chrome/Android e iOS).

---

## 🛠️ Tecnologias Utilizadas

- **React 18** + **Vite 6**
- **Tailwind CSS**
- **Supabase (`@supabase/supabase-js`)** — Banco PostgreSQL + Realtime + Presence
- **Lucide React** — Ícones
- **LZ-String** — Compressão de links compartilháveis

---

## 📦 Instalação das Bibliotecas

1. Certifique-se de ter o **Node.js** (versão 18 ou superior) e o **Git** instalados.
2. No terminal, dentro da pasta do projeto, instale todas as dependências listadas no `package.json`:

```bash
npm install
```

---

## 🗄️ Configuração do Banco em Tempo Real (Supabase)

O projeto utiliza o Supabase para sincronizar o planejamento e a corrida entre vários dispositivos usando o mesmo PIN.

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No **SQL Editor** do Supabase, execute o comando abaixo para criar a tabela e ativar o Realtime:

```sql
create table if not exists public.race_strategies (
  room_pin text primary key,
  strategy_data jsonb not null,
  updated_by text,
  updated_at timestamptz default now()
);

alter table public.race_strategies enable row level security;

create policy "Permitir leitura e escrita por PIN"
  on public.race_strategies
  for all
  using (true)
  with check (true);

alter publication supabase_realtime add table public.race_strategies;
```

3. Crie um arquivo `.env` na raiz do projeto (ele já é ignorado pelo `.gitignore`) com a URL e a **Publishable key** do seu projeto:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_PUBLISHABLE_KEY_AQUI
```

---

## 🚀 Como Ligar e Desligar o Servidor Local

### Ligar o servidor (apenas no seu computador)
```bash
npm run dev
```
Acesse no navegador: `http://localhost:5173`

### Ligar o servidor acessível pelo celular (mesmo Wi-Fi)
```bash
npm run dev -- --host
```
O terminal exibirá um endereço `Network` (ex.: `http://192.168.x.x:5173`) para abrir direto no celular.

### Desligar o servidor
Clique no terminal onde o servidor está rodando e pressione:
```text
Ctrl + C
```

### Gerar e testar versão de produção (Build)
```bash
npm run build
npm run preview
```

---

## ☁️ Como Subir Atualizações para o GitHub

> **Atenção:** O arquivo `.env` está listado no `.gitignore` e **não** é enviado para o GitHub por segurança.

### Pelo Terminal:
1. Verificar arquivos modificados:
   ```bash
   git status
   ```
2. Adicionar todas as alterações:
   ```bash
   git add .
   ```
3. Criar o commit com uma mensagem descritiva:
   ```bash
   git commit -m "feat: descrição da sua atualização"
   ```
4. Enviar para o GitHub:
   ```bash
   git push
   ```

### Pelo VS Code / GitHub Desktop:
1. Abra a aba **Controle do Código-Fonte** (ícone de ramificação no menu lateral).
2. Escreva o título do commit no campo de mensagem.
3. Clique em **Commit** (✓) e depois em **Sincronizar Alterações / Push**.

---

## 🌐 Deploy em Produção (Vercel / Netlify)

1. Conecte o repositório do GitHub na **Vercel** ou **Netlify**.
2. Em **Settings → Environment Variables**, adicione as mesmas duas variáveis do `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Comando de build: `npm run build` | Pasta de saída: `dist`.
4. Após o `git push`, o site publicado é atualizado automaticamente.

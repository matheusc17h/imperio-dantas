-- =====================================================================
-- IMPÉRIO DANTAS · banco de dados (Postgres)
-- Rodar no painel SQL do provedor (Neon, Supabase...). Pode rodar de novo
-- sem perder nada: cada comando só cria/ajusta o que ainda não existe.
-- =====================================================================

-- permite a regra "sem dois horários sobrepostos para o mesmo profissional"
create extension if not exists btree_gist;

-- contas: clientes, barbeiros e o admin. senha_hash guarda só o hash scrypt
-- (ver hashSenha em api/_lib.js), nunca a senha.
create table if not exists contas (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  nome         text        not null check (char_length(nome) between 2 and 80),
  email        text        not null unique check (char_length(email) between 5 and 160 and email = lower(email)),
  telefone     text        check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  senha_hash   text        not null check (senha_hash like 'scrypt$%'),
  papel        text        not null default 'cliente' check (papel in ('cliente', 'barbeiro', 'admin')),
  atende       boolean     not null default false,  -- aparece no passo "Profissional" do agendamento
  ativo        boolean     not null default true,
  foto         text,                                -- foto de perfil: "data:image/webp;base64,..." (pequena)
  foto_versao  integer     not null default 0
);
-- senha provisória (primeiro acesso do admin, barbeiro criado no painel ou senha trocada pelo admin):
-- enquanto for true, o site obriga a pessoa a criar a própria senha antes de usar o painel
alter table contas add column if not exists trocar_senha boolean not null default false;
-- verificação em duas etapas (só equipe): código de 6 números de um app autenticador (TOTP).
-- totp_pendente: segredo gerado na ativação, até a pessoa confirmar o primeiro código.
-- totp_ultimo: último intervalo de 30 s já usado (o mesmo código não serve duas vezes).
-- codigos_recuperacao: hash SHA-256 de cada código de recuperação ainda não usado.
alter table contas add column if not exists totp_segredo text;
alter table contas add column if not exists totp_pendente text;
alter table contas add column if not exists totp_ativo boolean not null default false;
alter table contas add column if not exists totp_ultimo bigint not null default 0;
alter table contas add column if not exists codigos_recuperacao text[] not null default '{}';
-- área em que a pessoa atende no site: cabelo masculino, feminino ou os dois
alter table contas add column if not exists area text not null default 'ambos';
alter table contas drop constraint if exists contas_area_check;
alter table contas add constraint contas_area_check check (area in ('masculino', 'feminino', 'ambos'));
-- dois profissionais com o mesmo nome confundiriam a agenda
create unique index if not exists contas_nome_profissional on contas (lower(nome)) where papel <> 'cliente';

-- sessões de login (o navegador guarda só o token; aqui fica o hash dele)
create table if not exists sessoes (
  token_hash  text        primary key,
  conta_id    bigint      not null references contas (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null
);
create index if not exists sessoes_conta on sessoes (conta_id);
-- 'completa' = entrou; 'falta2fa' = acertou a senha mas ainda falta o código do app (vale 10 min)
alter table sessoes add column if not exists nivel text not null default 'completa';

-- links de "Esqueci minha senha" (uso único, valem 1 hora)
create table if not exists redefinicoes (
  token_hash  text        primary key,
  conta_id    bigint,     -- null = primeiro acesso do admin (a conta é criada ao definir a senha)
  email       text        not null,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  usado       boolean     not null default false
);

create table if not exists agendamentos (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  nome          text        not null check (char_length(nome) between 2 and 80),
  telefone      text        not null check (telefone ~ '^[0-9]{10,13}$'),
  servicos      text[]      not null check (cardinality(servicos) between 1 and 6),
  profissional  text        not null,
  inicio        timestamptz not null,
  fim           timestamptz not null check (fim > inicio),
  total         integer     not null check (total >= 0),          -- em reais
  status        text        not null default 'pendente',
  -- o próprio banco recusa dois atendimentos no mesmo horário com o mesmo profissional
  constraint sem_sobreposicao exclude using gist (
    profissional with =, tstzrange(inicio, fim) with &&
  ) where (status <> 'cancelado')
);
alter table agendamentos add column if not exists conta_id bigint references contas (id) on delete set null;
alter table agendamentos drop constraint if exists agendamentos_status_check;
alter table agendamentos add constraint agendamentos_status_check
  check (status in ('pendente', 'confirmado', 'cancelado', 'concluido', 'faltou'));
create index if not exists agendamentos_inicio on agendamentos (inicio);
create index if not exists agendamentos_telefone on agendamentos (telefone);
create index if not exists agendamentos_conta on agendamentos (conta_id);

-- atendimentos feitos (é daqui que sai o faturamento). Entram de dois jeitos:
-- lançados no painel, ou ao marcar um agendamento como "concluído".
create table if not exists atendimentos (
  id              bigint generated always as identity primary key,
  criado_em       timestamptz not null default now(),
  quando          timestamptz not null,
  servicos        text[]      not null check (cardinality(servicos) between 1 and 6),
  valor           integer     not null check (valor between 0 and 100000),  -- em reais
  profissional    text        not null,
  agendamento_id  bigint      unique references agendamentos (id) on delete set null,
  lancado_por     bigint      references contas (id) on delete set null
);
create index if not exists atendimentos_quando on atendimentos (quando);

-- pausas e folgas em datas específicas (ex.: dia 12, das 16h às 17h).
-- profissional null = vale para todos.
create table if not exists bloqueios (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  profissional  text,
  inicio        timestamptz not null,
  fim           timestamptz not null check (fim > inicio),
  motivo        text        check (motivo is null or char_length(motivo) <= 80)
);
create index if not exists bloqueios_inicio on bloqueios (inicio);

-- preços, durações, horário de funcionamento e pausas fixas (editados no painel).
-- Sem linha aqui, valem os padrões de api/_lib.js.
create table if not exists config (
  chave          text        primary key,
  valor          jsonb       not null,
  atualizado_em  timestamptz not null default now()
);

-- rate limit: uma linha por chamada (o IP fica guardado só como hash)
create table if not exists limites (
  chave      text        not null,
  criado_em  timestamptz not null default now()
);
create index if not exists limites_chave on limites (chave, criado_em);

-- a versão antiga deste arquivo criava a tabela "clientes", que nunca foi usada pelo
-- site (agora é "contas"). Se ela existir no banco, pode ser apagada à mão.

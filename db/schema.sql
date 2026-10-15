-- =====================================================================
-- IMPÉRIO DANTAS · banco de dados (Postgres)
-- Rodar uma vez no painel SQL do provedor (Neon, Supabase...).
-- =====================================================================

-- permite a regra "sem dois horários sobrepostos para o mesmo profissional"
create extension if not exists btree_gist;

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
  status        text        not null default 'pendente'
                check (status in ('pendente', 'confirmado', 'cancelado', 'concluido')),
  -- o próprio banco recusa dois atendimentos no mesmo horário com o mesmo profissional
  constraint sem_sobreposicao exclude using gist (
    profissional with =, tstzrange(inicio, fim) with &&
  ) where (status <> 'cancelado')
);
create index if not exists agendamentos_inicio on agendamentos (inicio);
create index if not exists agendamentos_telefone on agendamentos (telefone);

-- rate limit: uma linha por chamada (o IP fica guardado só como hash)
create table if not exists limites (
  chave      text        not null,
  criado_em  timestamptz not null default now()
);
create index if not exists limites_chave on limites (chave, criado_em);

-- clientes (para o login de entrar.html / agendamentos.html)
-- senha_hash guarda só o hash scrypt (ver hashSenha em api/_lib.js), nunca a senha
create table if not exists clientes (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  nome        text        not null check (char_length(nome) between 2 and 80),
  telefone    text        not null unique check (telefone ~ '^[0-9]{10,13}$'),
  email       text        unique check (email is null or char_length(email) <= 160),
  senha_hash  text        not null check (senha_hash like 'scrypt$%')
);

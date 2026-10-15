/* =====================================================================
   IMPÉRIO DANTAS · base da API de agendamento
   Arquivos com "_" na frente não viram rota na Vercel.

   Segurança:
   - SQL injection: toda consulta usa o "sql`...`" do Neon, que manda os
     valores separados do comando (consulta parametrizada). Nunca montar
     SQL juntando texto.
   - O navegador não decide preço, duração nem horário: tudo é conferido
     aqui com as tabelas abaixo.
   - Rate limit por IP (guardado como hash, não o IP puro) na tabela "limites".
   - Senhas (login de clientes): só o hash scrypt com sal próprio vai para o
     banco, nunca a senha. Usar hashSenha() e conferirSenha() abaixo.
   ===================================================================== */
import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Preço e duração no servidor. MANTER IGUAL à tabela de preços do index.html.
export const SERVICOS = {
  'Corte social': { preco: 30, min: 30 },
  'Corte degradê': { preco: 35, min: 35 },
  'Corte navalhado': { preco: 40, min: 40 },
  'Relaxamento': { preco: 30, min: 20 },
  'Progressiva': { preco: 85, min: 40 },
  'Botox': { preco: 70, min: 40 },
  'Luzes': { preco: 100, min: 60 },
  'Nevou': { preco: 130, min: 60 },
  'Barba': { preco: 25, min: 25 },
  'Limpeza de pele': { preco: 15, min: 20 },
  'Limpeza completa': { preco: 30, min: 30 },
  'Penteados': { preco: 30, min: 25 },
};

// MANTER IGUAL a CONFIG.profissionais do js/main.js
export const PROFISSIONAIS = ['Gabriel Dantas'];

// 0 = domingo ... 6 = sábado. null = fechado. MANTER IGUAL ao js/main.js
export const HORARIOS = {
  0: ['09:00', '15:00'],
  1: null,
  2: ['09:00', '20:00'],
  3: ['09:00', '20:00'],
  4: ['09:00', '20:00'],
  5: ['09:00', '20:00'],
  6: ['09:00', '20:00'],
};

export const INTERVALO = 30;      // horários de 30 em 30 minutos
export const DIAS_A_FRENTE = 30;  // até quantos dias à frente dá para marcar
export const ANTECEDENCIA = 30;   // minutos mínimos entre agora e o horário marcado

let conexao;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  conexao ??= neon(process.env.DATABASE_URL);
  return conexao;
}

export const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// "hoje" e "agora" em São Paulo, independente do fuso do servidor
export function agoraSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

const diasEntre = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5;

// Confere se a data existe, está no prazo e o salão abre nesse dia. Devolve o dia da semana ou null.
export function diaValido(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const dt = new Date(data + 'T00:00:00Z');
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== data) return null;
  const distancia = diasEntre(agoraSP().data, data);
  if (distancia < 0 || distancia > DIAS_A_FRENTE) return null;
  const semana = dt.getUTCDay();
  return HORARIOS[semana] ? semana : null;
}

// Confere se o horário cabe no expediente com a duração pedida e não está no passado.
export function horarioValido(data, hora, duracao) {
  const semana = diaValido(data);
  if (semana === null || typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return false;
  const [abre, fecha] = HORARIOS[semana].map(minutos);
  const ini = minutos(hora);
  if ((ini - abre) % INTERVALO !== 0 || ini < abre || ini + duracao > fecha) return false;
  const agora = agoraSP();
  if (data === agora.data && ini < agora.min + ANTECEDENCIA) return false;
  return true;
}

// Horário de Brasília não tem mais horário de verão: -03:00 o ano todo.
export const instante = (data, hhmm) => `${data}T${hhmm}:00-03:00`;
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

if (!process.env.SAL_IP) console.warn('SAL_IP não configurado: o hash do IP fica sem sal');

// IP do visitante. Na Vercel estes cabeçalhos são preenchidos pela própria plataforma
// (o que o visitante manda é substituído). Em outra hospedagem, conferir de onde vem o IP real.
function ipHash(req) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for']
    || req.socket?.remoteAddress || '?').split(',')[0].trim();
  return createHash('sha256').update(ip + (process.env.SAL_IP || '')).digest('hex').slice(0, 32);
}

// Rate limit: no máximo "max" chamadas de "acao" por IP a cada "janela" minutos.
export async function limitar(req, acao, max, janela) {
  const sql = db();
  const chave = `${acao}:${ipHash(req)}`;
  // registra primeiro e conta depois: pedidos simultâneos não conseguem furar o limite
  await sql`insert into limites (chave) values (${chave})`;
  const [{ n }] = await sql`
    select count(*)::int as n from limites
    where chave = ${chave} and criado_em > now() - make_interval(mins => ${janela})`;
  if (n > max) return false;
  // faxina de vez em quando: apaga registros com mais de um dia
  if (Math.random() < 0.02) await sql`delete from limites where criado_em < now() - interval '1 day'`;
  return true;
}

export function responder(res, status, corpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  return res.status(status).json(corpo);
}

/* ---------- Senhas: scrypt (lento de propósito) + sal aleatório por senha ----------
   Formato guardado: "scrypt$N$r$p$sal$hash" (tudo em base64url, menos os números).
   Para o login que vai existir em entrar.html. */
const scryptAsync = promisify(scrypt);
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8 || senha.length > 200) throw new Error('Senha inválida');
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha.normalize('NFKC'), sal, 64, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function conferirSenha(senha, guardado) {
  const [alg, N, r, p, sal, hash] = String(guardado).split('$');
  if (alg !== 'scrypt' || typeof senha !== 'string' || senha.length > 200 || !sal || !hash) return false;
  // só aceita os parâmetros que este código gera (evita hash adulterado pedindo custo absurdo)
  if (Number(N) !== PARAMS.N || Number(r) !== PARAMS.r || Number(p) !== PARAMS.p) return false;
  try {
    const esperado = Buffer.from(hash, 'base64url');
    if (esperado.length !== 64) return false;
    const calculado = await scryptAsync(senha.normalize('NFKC'), Buffer.from(sal, 'base64url'), 64, PARAMS);
    return timingSafeEqual(esperado, calculado); // comparação em tempo constante
  } catch {
    return false;
  }
}

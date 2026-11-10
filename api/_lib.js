/* =====================================================================
   IMPÉRIO DANTAS · base da API (agendamento, contas e painel)
   Arquivos com "_" na frente não viram rota na Vercel.

   Segurança:
   - SQL injection: toda consulta usa o "sql`...`" do Neon, que manda os
     valores separados do comando (consulta parametrizada). Nunca montar
     SQL juntando texto.
   - O navegador não decide preço, duração nem horário: tudo é conferido
     aqui com a configuração do banco (getConfig).
   - Rate limit por IP (guardado como hash, não o IP puro) na tabela "limites".
   - Senhas: só o hash scrypt com sal próprio vai para o banco.
   - Login: cookie "__Host-sessao" HttpOnly + Secure + SameSite=Lax. O banco
     guarda só o hash do token.
   ===================================================================== */
import { neon } from '@neondatabase/serverless';
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/* ---------- Padrões (valem enquanto o admin não salvar outra coisa no painel) ---------- */
// Preço (R$), duração (min) e área. A lista de nomes é fixa: é a mesma da tabela de preços do index.html.
// área: 'masculino' (cabelo masculino), 'feminino' (cabelo feminino) ou 'ambos' (aparece nos dois lados)
export const AREAS = ['masculino', 'feminino', 'ambos'];
export const SERVICOS_PADRAO = {
  'Corte social': { preco: 30, min: 30, area: 'masculino' },
  'Corte degradê': { preco: 35, min: 35, area: 'masculino' },
  'Corte navalhado': { preco: 40, min: 40, area: 'masculino' },
  'Relaxamento': { preco: 30, min: 20, area: 'ambos' },
  'Progressiva': { preco: 85, min: 40, area: 'ambos' },
  'Botox': { preco: 70, min: 40, area: 'ambos' },
  'Luzes': { preco: 100, min: 60, area: 'ambos' },
  'Nevou': { preco: 130, min: 60, area: 'masculino' },
  'Barba': { preco: 25, min: 25, area: 'masculino' },
  'Limpeza de pele': { preco: 15, min: 20, area: 'ambos' },
  'Limpeza completa': { preco: 30, min: 30, area: 'ambos' },
  'Penteados': { preco: 30, min: 25, area: 'ambos' },
  // FICTÍCIO: serviços de cabelo feminino de exemplo (nome, preço e tempo). Trocar pelos reais,
  // aqui E na tabela de preços do index.html (data-servico, data-preco, data-min) e no JSON-LD.
  // Valores de referência: faixa de baixo de salão de bairro (pesquisa de 2026), para ficar no
  // mesmo nível dos preços reais da casa.
  'Corte feminino': { preco: 50, min: 45, area: 'feminino' },
  'Escova': { preco: 40, min: 40, area: 'feminino' },
  'Hidratação': { preco: 45, min: 40, area: 'feminino' },
  'Cauterização': { preco: 80, min: 60, area: 'feminino' },
  'Selagem': { preco: 120, min: 120, area: 'feminino' },
  'Alisamento': { preco: 150, min: 150, area: 'feminino' },
  'Coloração': { preco: 90, min: 90, area: 'feminino' },
  'Mechas': { preco: 150, min: 120, area: 'feminino' },
  'Morena iluminada': { preco: 280, min: 180, area: 'feminino' },
};
// serviços escolhidos juntos: que área eles pedem ('masculino', 'feminino', null = qualquer, false = misturou os dois)
export function areaDosServicos(nomes) {
  const exclusivas = [...new Set(nomes.map((n) => SERVICOS_PADRAO[n]?.area).filter((a) => a && a !== 'ambos'))];
  if (exclusivas.length > 1) return false;
  return exclusivas[0] || null;
}
// quem atende cada área: 'ambos' atende tudo
export const atendeArea = (pessoa, area) => !area || pessoa.area === 'ambos' || pessoa.area === area;

// 0 = domingo ... 6 = sábado. null = fechado.
export const HORARIOS_PADRAO = {
  0: ['09:00', '15:00'],
  1: null,
  2: ['09:00', '20:00'],
  3: ['09:00', '20:00'],
  4: ['09:00', '20:00'],
  5: ['09:00', '20:00'],
  6: ['09:00', '20:00'],
};

// pausas fixas por dia da semana, ex.: { 2: [['16:00', '17:00']] }
export const PAUSAS_PADRAO = {};

// enquanto ninguém da equipe estiver marcado como "atende" no painel
export const PROFISSIONAL_PADRAO = 'Dantas';
export const PROFISSIONAIS_PADRAO = [
  { id: null, nome: PROFISSIONAL_PADRAO, foto: null, area: 'masculino' },
  { id: null, nome: 'Larissa Mendes', foto: null, area: 'feminino' }, // FICTÍCIO: nome da profissional do cabelo feminino
];

export const INTERVALO = 30;      // horários de 30 em 30 minutos
export const DIAS_A_FRENTE = 30;  // até quantos dias à frente dá para marcar
export const ANTECEDENCIA = 30;   // minutos mínimos entre agora e o horário marcado
export const FUSO = 'America/Sao_Paulo';

let conexao;
export function db() {
  if (globalThis.__bancoLocal) return globalThis.__bancoLocal; // só nos testes locais (pasta _teste/)
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  conexao ??= neon(process.env.DATABASE_URL);
  return conexao;
}

export const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const ehHora = (txt) => typeof txt === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(txt);
export const ehData = (txt) => {
  if (typeof txt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(txt)) return false;
  const dt = new Date(txt + 'T00:00:00Z');
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === txt;
};
export const limpar = (txt, max) => String(txt ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// "hoje" e "agora" em São Paulo, independente do fuso do servidor
export function agoraSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

export const diasEntre = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5;
export const somarDias = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// Horário de Brasília não tem mais horário de verão: -03:00 o ano todo.
export const instante = (data, hora) => `${data}T${hora}:00-03:00`;

/* ---------- Configuração editável (preços, horários, pausas) ----------
   Fica na tabela "config". Cada instância guarda uma cópia por 15 s. */
let cacheConfig = null;
export async function getConfig() {
  if (cacheConfig && Date.now() - cacheConfig.em < 15000) return cacheConfig.valor;
  const linhas = await db()`select chave, valor from config where chave in ('servicos', 'horarios', 'pausas')`;
  const salvo = Object.fromEntries(linhas.map((l) => [l.chave, typeof l.valor === 'string' ? JSON.parse(l.valor) : l.valor]));
  const servicos = {};
  // preço e tempo podem mudar no painel; a área é sempre a daqui
  for (const [nome, padrao] of Object.entries(SERVICOS_PADRAO)) servicos[nome] = { ...padrao, ...(salvo.servicos?.[nome] || {}), area: padrao.area };
  const valor = {
    servicos,
    horarios: { ...HORARIOS_PADRAO, ...(salvo.horarios || {}) },
    pausas: { ...PAUSAS_PADRAO, ...(salvo.pausas || {}) },
  };
  cacheConfig = { em: Date.now(), valor };
  return valor;
}
export async function salvarConfig(chave, valor) {
  await db()`
    insert into config (chave, valor) values (${chave}, ${JSON.stringify(valor)}::jsonb)
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`;
  cacheConfig = null;
}

// quem atende (aparece no passo "Profissional"). O admin marca isso na Equipe do painel.
export async function profissionais() {
  const linhas = await db()`
    select id, nome, area, foto_versao, (foto is not null) as tem_foto from contas
    where atende and ativo and papel <> 'cliente'
    order by (papel = 'admin') desc, nome`;
  if (!linhas.length) return PROFISSIONAIS_PADRAO.map((p) => ({ ...p }));
  return linhas.map((l) => ({ id: Number(l.id), nome: l.nome, area: l.area || 'ambos', foto: l.tem_foto ? `/api/foto?id=${l.id}&v=${l.foto_versao}` : null }));
}

// Confere se a data existe, está no prazo e o salão abre nesse dia. Devolve o dia da semana ou null.
export function diaValido(cfg, data) {
  if (!ehData(data)) return null;
  const distancia = diasEntre(agoraSP().data, data);
  if (distancia < 0 || distancia > DIAS_A_FRENTE) return null;
  const semana = new Date(data + 'T00:00:00Z').getUTCDay();
  return cfg.horarios[semana] ? semana : null;
}

// Confere se o horário cabe no expediente com a duração pedida, fora das pausas fixas e não no passado.
export function horarioValido(cfg, data, hora, duracao) {
  const semana = diaValido(cfg, data);
  if (semana === null || !ehHora(hora)) return false;
  const [abre, fecha] = cfg.horarios[semana].map(minutos);
  const ini = minutos(hora);
  const fim = ini + duracao;
  if ((ini - abre) % INTERVALO !== 0 || ini < abre || fim > fecha) return false;
  if ((cfg.pausas[semana] || []).some(([a, b]) => ini < minutos(b) && fim > minutos(a))) return false;
  const agora = agoraSP();
  if (data === agora.data && ini < agora.min + ANTECEDENCIA) return false;
  return true;
}

if (!process.env.SAL_IP) console.warn('SAL_IP não configurado: o hash do IP fica sem sal');

// IP do visitante. Vercel: x-vercel-forwarded-for. Render: passa pelo Cloudflare, que grava o IP real
// em cf-connecting-ip (o que o visitante manda nesses cabeçalhos é substituído pela plataforma).
// x-forwarded-for fica por último porque o próprio visitante consegue escrever nele.
function ipHash(req) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['cf-connecting-ip'] || req.headers['true-client-ip']
    || req.headers['x-real-ip'] || req.headers['x-forwarded-for']
    || req.socket?.remoteAddress || '?').split(',')[0].trim();
  return createHash('sha256').update(ip + (process.env.SAL_IP || '')).digest('hex').slice(0, 32);
}

// Rate limit: no máximo "max" chamadas de "acao" por IP a cada "janela" minutos.
// "extra" junta mais um pedaço à chave (ex.: o e-mail, para limitar tentativas por conta).
export async function limitar(req, acao, max, janela, extra = '') {
  const sql = db();
  const chave = `${acao}:${extra ? createHash('sha256').update(extra).digest('hex').slice(0, 24) : ipHash(req)}`;
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

// corpo JSON de um POST (ou null se não for JSON de objeto)
export function corpo(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) return null;
  const b = req.body;
  return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
}

/* ---------- Senhas: scrypt (lento de propósito) + sal aleatório por senha ----------
   Formato guardado: "scrypt$N$r$p$sal$hash" (tudo em base64url, menos os números). */
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
// hash de uma senha que ninguém sabe: usado quando o e-mail não existe, para o login
// demorar o mesmo tempo e não entregar quais e-mails têm conta
let hashFalso;
export async function hashDeMentira() { return (hashFalso ??= await hashSenha(randomBytes(18).toString('base64url'))); }

export const senhaValida = (s) => typeof s === 'string' && s.length >= 8 && s.length <= 200;
export const normalizarEmail = (e) => String(e ?? '').trim().toLowerCase().slice(0, 160);
export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length >= 5 && e.length <= 160;
export const emailAdmin = () => normalizarEmail(process.env.ADMIN_EMAIL);
export const tokenAleatorio = () => randomBytes(32).toString('base64url');
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

/* ---------- Sessão (login) ---------- */
const COOKIE = '__Host-sessao';
const DIAS_SESSAO = 30;

function lerCookie(req, nome) {
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return '';
}

// nivel 'completa' = entrou de vez; 'falta2fa' = acertou a senha, falta o código do app (dura 10 min)
export async function abrirSessao(res, contaId, nivel = 'completa') {
  const token = tokenAleatorio();
  const minutos = nivel === 'completa' ? DIAS_SESSAO * 1440 : 10;
  await db()`
    insert into sessoes (token_hash, conta_id, expira_em, nivel)
    values (${hashToken(token)}, ${contaId}, now() + make_interval(mins => ${minutos}), ${nivel})`;
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${minutos * 60}`);
}

// sessão que acertou a senha e espera o código do app (ou null)
export async function sessaoFalta2fa(req) {
  const token = lerCookie(req, COOKIE);
  if (!token || token.length > 100) return null;
  const [s] = await db()`
    select s.conta_id from sessoes s join contas c on c.id = s.conta_id
    where s.token_hash = ${hashToken(token)} and s.nivel = 'falta2fa' and s.expira_em > now() and c.ativo`;
  return s ? { contaId: Number(s.conta_id), token } : null;
}
// código certo: a mesma sessão passa a valer de vez (30 dias)
export async function completarSessao(res, token) {
  await db()`
    update sessoes set nivel = 'completa', expira_em = now() + make_interval(days => ${DIAS_SESSAO})
    where token_hash = ${hashToken(token)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS_SESSAO * 86400}`);
}

/* ---------- Verificação em duas etapas (TOTP, RFC 6238: Google/Microsoft Authenticator) ----------
   Segredo de 20 bytes em base32; código de 6 dígitos a cada 30 s; aceita 1 intervalo antes/depois
   (relógio do celular adiantado ou atrasado) e nunca o mesmo intervalo duas vezes. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0; let valor = 0; let out = '';
  for (const b of buf) {
    valor = (valor << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(valor >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}
function deBase32(txt) {
  let bits = 0; let valor = 0; const out = [];
  for (const ch of String(txt).replace(/[\s=]/g, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    valor = (valor << 5) | i; bits += 5;
    if (bits >= 8) { out.push((valor >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function codigoTotp(segredo, passo) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', deBase32(segredo)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
export const novoSegredoTotp = () => base32(randomBytes(20));
export const uriTotp = (segredo, email) =>
  `otpauth://totp/${encodeURIComponent(`Império Dantas:${email}`)}?secret=${segredo}&issuer=${encodeURIComponent('Império Dantas')}&algorithm=SHA1&digits=6&period=30`;
// devolve o intervalo usado (para gravar em totp_ultimo) ou null se o código não vale
export function conferirTotp(segredo, codigo, ultimo = 0) {
  if (!segredo || !/^\d{6}$/.test(String(codigo))) return null;
  const agora = Math.floor(Date.now() / 30000);
  for (const passo of [agora - 1, agora, agora + 1]) {
    if (passo <= Number(ultimo)) continue;
    const certo = Buffer.from(codigoTotp(segredo, passo));
    if (timingSafeEqual(certo, Buffer.from(String(codigo)))) return passo;
  }
  return null;
}
// 8 códigos de recuperação (uso único), no formato XXXX-XXXX; o banco guarda só o hash
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function novosCodigosRecuperacao() {
  const codigos = Array.from({ length: 8 }, () => {
    const p = () => Array.from({ length: 4 }, () => LETRAS[randomInt(LETRAS.length)]).join('');
    return `${p()}-${p()}`;
  });
  return { codigos, hashes: codigos.map((c) => hashRecuperacao(c)) };
}
export const hashRecuperacao = (c) => createHash('sha256').update(String(c).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

export async function fecharSessao(req, res) {
  const token = lerCookie(req, COOKIE);
  if (token) await db()`delete from sessoes where token_hash = ${hashToken(token)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

// dados públicos de uma conta. Nunca devolve senha_hash nem a foto em si.
const publica = (c) => c && ({
  id: Number(c.id), nome: c.nome, email: c.email, telefone: c.telefone, papel: c.papel, atende: c.atende,
  foto: c.tem_foto ? `/api/foto?id=${c.id}&v=${c.foto_versao}` : null,
  trocarSenha: Boolean(c.trocar_senha), // senha provisória: tem que criar a própria antes de continuar
  doisFatores: Boolean(c.totp_ativo),
  // equipe sem a verificação em duas etapas ativada: tem que ativar antes de usar o painel
  configurar2fa: c.papel !== 'cliente' && !c.totp_ativo,
});

// conta logada (ou null)
export async function contaDaSessao(req) {
  const token = lerCookie(req, COOKIE);
  if (!token || token.length > 100) return null;
  const [c] = await db()`
    select c.id, c.nome, c.email, c.telefone, c.papel, c.atende, c.trocar_senha, c.totp_ativo, c.foto_versao, (c.foto is not null) as tem_foto
    from sessoes s join contas c on c.id = s.conta_id
    where s.token_hash = ${hashToken(token)} and s.expira_em > now() and s.nivel = 'completa' and c.ativo`;
  return publica(c) || null;
}

export async function contaPorId(id) {
  const [c] = await db()`
    select id, nome, email, telefone, papel, atende, trocar_senha, totp_ativo, foto_versao, (foto is not null) as tem_foto
    from contas where id = ${id} and ativo`;
  return publica(c) || null;
}

/* ---------- E-mail (Resend) ---------- */
export const urlSite = () => String(process.env.SITE_URL || 'https://imperio-dantas.vercel.app').replace(/\/+$/, '');

export async function enviarEmail({ para, assunto, html, texto }) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn('RESEND_API_KEY não configurada: e-mail não enviado');
    // só no computador (fora da Vercel) mostra o conteúdo, para dar para testar sem e-mail
    if (!process.env.VERCEL) console.log(`[e-mail para ${para}] ${assunto}\n${texto}`);
    return false;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE || 'Império Dantas <onboarding@resend.dev>',
      to: [para], subject: assunto, html, text: texto,
    }),
  });
  if (!r.ok) console.error('resend', r.status, await r.text().catch(() => ''));
  return r.ok;
}

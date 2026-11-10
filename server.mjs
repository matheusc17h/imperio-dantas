/* =====================================================================
   IMPÉRIO DANTAS · servidor para o Render (ou qualquer hospedagem Node)
   - Entrega só os arquivos públicos do site (lista fechada abaixo: nunca .env, api/, db/, _teste/...).
   - /api/<nome> roda o mesmo arquivo api/<nome>.js que a Vercel rodaria (mesmo formato req/res).
   - Mesmos cabeçalhos de segurança do vercel.json.
   Iniciar: npm start  (porta em PORT; o Render preenche sozinho)
   ===================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PORTA = Number(process.env.PORT) || 3000;

// o que pode ser baixado por qualquer pessoa (o resto da pasta fica fechado)
const PUBLICOS = new Set(['index.html', 'entrar.html', 'painel.html', 'robots.txt', 'sitemap.xml',
  'favicon.ico', 'favicon.svg', 'favicon-512.png', 'apple-touch-icon.png']);
const PASTAS_PUBLICAS = ['css/', 'js/', 'img/site/'];
const ROTAS_API = new Set(['agendamentos', 'config', 'conta', 'foto', 'horarios', 'painel']);

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const SEGURANCA = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-src https://www.google.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const LIMITE_CORPO = 1024 * 1024; // 1 MB (a maior coisa enviada é a foto de perfil, já reduzida)

async function api(nome, req, res, url) {
  const mod = await import(pathToFileURL(join(RAIZ, 'api', `${nome}.js`)).href);
  let tamanho = 0;
  const partes = [];
  for await (const c of req) {
    tamanho += c.length;
    if (tamanho > LIMITE_CORPO) { res.statusCode = 413; res.end(); return; }
    partes.push(c);
  }
  const txt = Buffer.concat(partes).toString('utf8');
  req.query = Object.fromEntries(url.searchParams);
  try { req.body = txt ? JSON.parse(txt) : undefined; } catch { req.body = undefined; }
  // o mesmo jeitinho das funções da Vercel: res.status(...).json(...) / .send(...)
  res.status = (s) => { res.statusCode = s; return res; };
  res.json = (o) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(b); return res; };
  await mod.default(req, res);
}

async function arquivo(caminho, req, res) {
  let rel = normalize(decodeURIComponent(caminho)).replace(/^[\\/]+/, '').split(sep).join('/');
  if (rel === '' || rel === '.') rel = 'index.html';
  const liberado = PUBLICOS.has(rel) || PASTAS_PUBLICAS.some((p) => rel.startsWith(p) && !rel.includes('..'));
  if (!liberado) return false;
  const completo = join(RAIZ, rel);
  if (!completo.startsWith(RAIZ)) return false;
  const info = await stat(completo).catch(() => null);
  if (!info?.isFile()) return false;
  const ext = extname(completo).toLowerCase();
  res.setHeader('Content-Type', TIPOS[ext] || 'application/octet-stream');
  // HTML, CSS e JS: o navegador confere se mudou a cada visita; imagens ficam 1 dia guardadas
  res.setHeader('Cache-Control', ['.html', '.css', '.js', '.xml', '.txt'].includes(ext) ? 'no-cache' : 'public, max-age=86400');
  const modificado = info.mtime.toUTCString();
  res.setHeader('Last-Modified', modificado);
  if (req.headers['if-modified-since'] === modificado) { res.statusCode = 304; res.end(); return true; }
  if (req.method === 'HEAD') { res.end(); return true; }
  res.end(await readFile(completo));
  return true;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  for (const [k, v] of Object.entries(SEGURANCA)) res.setHeader(k, v);
  try {
    if (url.pathname.startsWith('/api/')) {
      const nome = url.pathname.slice(5).replace(/\/+$/, '');
      if (!ROTAS_API.has(nome)) { res.statusCode = 404; res.end(); return; }
      await api(nome, req, res, url);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end(); return; }
    if (await arquivo(url.pathname, req, res)) return;
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Página não encontrada.');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.end(); }
  }
}).listen(PORTA, () => console.log(`Império Dantas no ar na porta ${PORTA}`));

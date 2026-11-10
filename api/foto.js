/* GET /api/foto?id=N&v=versão
   Foto de perfil de quem atende (enviada no painel, já reduzida no navegador).
   O "v" muda a cada foto nova, então o navegador pode guardar por um ano. */
import { db } from './_lib.js';

export default async function handler(req, res) {
  const id = Number(req.query?.id);
  if (req.method !== 'GET' || !Number.isInteger(id) || id < 1) return res.status(404).end();
  try {
    const [c] = await db()`select foto from contas where id = ${id} and papel <> 'cliente' and ativo and foto is not null`;
    // guardada como "data:image/webp;base64,..." (o iPhone antigo gera jpeg em vez de webp)
    const m = c && /^data:(image\/(?:webp|jpeg|png));base64,(.+)$/.exec(c.foto);
    if (!m) return res.status(404).end();
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    return res.status(200).send(Buffer.from(m[2], 'base64'));
  } catch (e) {
    console.error('foto', e);
    return res.status(500).end();
  }
}

/* GET /api/config
   O que o site precisa para montar preços, horário e agendamento com os dados do painel:
   { servicos: [{ nome, preco, min, area }], horarios, pausas, profissionais: [{ nome, foto, area }] } */
import { getConfig, profissionais, responder } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });
  try {
    const cfg = await getConfig();
    const equipe = (await profissionais()).map(({ nome, foto, area }) => ({ nome, foto, area }));
    // pode ficar 30 s no cache da Vercel: mudança no painel aparece no site em até ~1 minuto
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json({
      servicos: Object.entries(cfg.servicos).map(([nome, s]) => ({ nome, preco: s.preco, min: s.min, area: s.area })),
      horarios: cfg.horarios,
      pausas: cfg.pausas,
      profissionais: equipe,
    });
  } catch (e) {
    console.error('config', e);
    return responder(res, 500, { erro: 'Não foi possível carregar.' });
  }
}

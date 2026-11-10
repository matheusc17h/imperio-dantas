/* GET /api/horarios?data=AAAA-MM-DD
   Devolve só os intervalos ocupados do dia (sem nome nem telefone de ninguém):
   horários marcados, pausas fixas do dia da semana e pausas/folgas do painel.
   profissional = null quer dizer "vale para todos". */
import { db, getConfig, diaValido, limitar, responder } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });
  const data = typeof req.query?.data === 'string' ? req.query.data : '';

  try {
    const cfg = await getConfig();
    const semana = diaValido(cfg, data);
    if (semana === null) return responder(res, 400, { erro: 'Data inválida.' });
    if (!(await limitar(req, 'horarios', 60, 1))) {
      return responder(res, 429, { erro: 'Muitas consultas seguidas. Espere um minuto.' });
    }
    const sql = db();
    const marcados = await sql`
      select profissional,
             to_char(inicio at time zone 'America/Sao_Paulo', 'HH24:MI') as inicio,
             to_char(fim at time zone 'America/Sao_Paulo', 'HH24:MI') as fim
      from agendamentos
      where status <> 'cancelado'
        and (inicio at time zone 'America/Sao_Paulo')::date = ${data}::date`;
    // bloqueio que passa da meia-noite vira "até 23:59" / "desde 00:00" neste dia
    const bloqueios = await sql`
      select profissional,
             to_char(greatest(inicio, ${data + 'T00:00:00-03:00'}::timestamptz) at time zone 'America/Sao_Paulo', 'HH24:MI') as inicio,
             case when fim >= ${data + 'T00:00:00-03:00'}::timestamptz + interval '1 day' then '23:59'
                  else to_char(fim at time zone 'America/Sao_Paulo', 'HH24:MI') end as fim
      from bloqueios
      where tstzrange(inicio, fim) && tstzrange(${data + 'T00:00:00-03:00'}::timestamptz, ${data + 'T00:00:00-03:00'}::timestamptz + interval '1 day')`;
    const pausas = (cfg.pausas[semana] || []).map(([inicio, fim]) => ({ profissional: null, inicio, fim }));
    return responder(res, 200, { ocupados: [...marcados, ...bloqueios, ...pausas] });
  } catch (e) {
    console.error('horarios', e);
    return responder(res, 500, { erro: 'Não foi possível consultar os horários.' });
  }
}

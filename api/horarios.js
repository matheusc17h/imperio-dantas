/* GET /api/horarios?data=AAAA-MM-DD
   Devolve só os intervalos ocupados do dia (sem nome nem telefone de ninguém). */
import { db, diaValido, limitar, responder } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });
  const data = typeof req.query?.data === 'string' ? req.query.data : '';
  if (diaValido(data) === null) return responder(res, 400, { erro: 'Data inválida.' });

  try {
    if (!(await limitar(req, 'horarios', 60, 1))) {
      return responder(res, 429, { erro: 'Muitas consultas seguidas. Espere um minuto.' });
    }
    const sql = db();
    const ocupados = await sql`
      select profissional,
             to_char(inicio at time zone 'America/Sao_Paulo', 'HH24:MI') as inicio,
             to_char(fim at time zone 'America/Sao_Paulo', 'HH24:MI') as fim
      from agendamentos
      where status <> 'cancelado'
        and (inicio at time zone 'America/Sao_Paulo')::date = ${data}::date`;
    return responder(res, 200, { ocupados });
  } catch (e) {
    console.error('horarios', e);
    return responder(res, 500, { erro: 'Não foi possível consultar os horários.' });
  }
}

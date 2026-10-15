/* POST /api/agendamentos
   Corpo (JSON): { servicos: string[], profissional: string, data: "AAAA-MM-DD",
                   hora: "HH:MM", nome: string, telefone: string, site: "" }
   "site" é um campo escondido (isca para robôs): se vier preenchido, finge que deu certo. */
import {
  SERVICOS, PROFISSIONAIS, db, horarioValido, instante, hhmm, minutos, limitar, responder,
} from './_lib.js';

const limpar = (txt, max) => String(txt ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return responder(res, 415, { erro: 'Formato inválido.' });
  }

  let b;
  try { b = req.body; } catch { return responder(res, 400, { erro: 'Dados inválidos.' }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return responder(res, 400, { erro: 'Dados inválidos.' });
  if (b.site) return responder(res, 201, { ok: true });

  // ---------- validação (o servidor confere tudo, não confia no navegador) ----------
  const nome = limpar(b.nome, 80);
  const telefone = String(b.telefone ?? '').replace(/\D/g, '');
  const servicos = Array.isArray(b.servicos) && b.servicos.length <= 6 ? [...new Set(b.servicos.map(String))] : [];
  const pedido = limpar(b.profissional, 60);
  const { data, hora } = b;

  if (nome.length < 2) return responder(res, 400, { erro: 'Informe seu nome.' });
  if (telefone.length < 10 || telefone.length > 13) return responder(res, 400, { erro: 'Telefone inválido.' });
  if (!servicos.length || servicos.length > 6 || !servicos.every((s) => SERVICOS[s])) {
    return responder(res, 400, { erro: 'Serviço inválido.' });
  }
  if (pedido && pedido !== 'Sem preferência' && !PROFISSIONAIS.includes(pedido)) {
    return responder(res, 400, { erro: 'Profissional inválido.' });
  }
  const duracao = servicos.reduce((t, s) => t + SERVICOS[s].min, 0);
  const total = servicos.reduce((t, s) => t + SERVICOS[s].preco, 0);
  if (!horarioValido(data, hora, duracao)) return responder(res, 400, { erro: 'Esse horário não está disponível.' });

  try {
    // 5 a cada 15 minutos e 10 por dia, por IP
    if (!(await limitar(req, 'agendar', 5, 15)) || !(await limitar(req, 'agendar-dia', 10, 1440))) {
      return responder(res, 429, { erro: 'Muitas tentativas seguidas. Espere alguns minutos ou chame no WhatsApp.' });
    }
    const sql = db();

    // no máximo 3 horários futuros em aberto por telefone
    const [{ n }] = await sql`
      select count(*)::int as n from agendamentos
      where telefone = ${telefone} and status <> 'cancelado' and inicio > now()`;
    if (n >= 3) return responder(res, 429, { erro: 'Você já tem 3 horários marcados. Chame no WhatsApp para mudar algum.' });

    const inicio = instante(data, hora);
    const fim = instante(data, hhmm(minutos(hora) + duracao));
    const candidatos = PROFISSIONAIS.includes(pedido) ? [pedido] : PROFISSIONAIS;

    // tenta cada profissional; a regra "exclude" do banco impede dois horários sobrepostos
    for (const profissional of candidatos) {
      try {
        const [linha] = await sql`
          insert into agendamentos (nome, telefone, servicos, profissional, inicio, fim, total)
          values (${nome}, ${telefone}, ${servicos}, ${profissional}, ${inicio}::timestamptz, ${fim}::timestamptz, ${total})
          returning id`;
        return responder(res, 201, { ok: true, id: linha.id, profissional });
      } catch (e) {
        if (e?.code === '23P01') continue; // horário já ocupado para esse profissional
        throw e;
      }
    }
    return responder(res, 409, { erro: 'Esse horário acabou de ser ocupado. Escolha outro.' });
  } catch (e) {
    console.error('agendamentos', e);
    return responder(res, 500, { erro: 'Não foi possível salvar agora.' });
  }
}

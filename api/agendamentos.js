/* POST /api/agendamentos  (precisa estar logado: ver /api/conta)
   Corpo (JSON): { servicos: string[], profissional: string, data: "AAAA-MM-DD",
                   hora: "HH:MM", site: "" }
   Nome e telefone vêm da conta. "site" é um campo escondido (isca para robôs):
   se vier preenchido, finge que deu certo. */
import {
  db, getConfig, profissionais, horarioValido, instante, hhmm, minutos, limitar, responder, corpo,
  limpar, contaDaSessao, areaDosServicos, atendeArea,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });
  const b = corpo(req);
  if (!b) return responder(res, 400, { erro: 'Dados inválidos.' });
  if (b.site) return responder(res, 201, { ok: true });

  try {
    const conta = await contaDaSessao(req);
    if (!conta) return responder(res, 401, { erro: 'Entre na sua conta para confirmar o horário.' });
    const telefone = conta.telefone || String(b.telefone ?? '').replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 13) return responder(res, 400, { erro: 'Telefone inválido.' });

    // ---------- validação (o servidor confere tudo, não confia no navegador) ----------
    const cfg = await getConfig();
    const servicos = Array.isArray(b.servicos) && b.servicos.length <= 6 ? [...new Set(b.servicos.map(String))] : [];
    const pedido = limpar(b.profissional, 60);
    const { data, hora } = b;

    if (!servicos.length || !servicos.every((s) => cfg.servicos[s])) return responder(res, 400, { erro: 'Serviço inválido.' });
    // cabelo masculino e feminino são atendidos por pessoas diferentes: um lado por vez
    const area = areaDosServicos(servicos);
    if (area === false) return responder(res, 400, { erro: 'Escolha serviços de cabelo masculino ou de cabelo feminino, não dos dois juntos.' });
    const equipe = (await profissionais()).filter((p) => atendeArea(p, area)).map((p) => p.nome);
    if (!equipe.length) return responder(res, 409, { erro: 'Ninguém da equipe atende esse serviço agora. Chame no WhatsApp.' });
    if (pedido && pedido !== 'Sem preferência' && !equipe.includes(pedido)) {
      return responder(res, 400, { erro: 'Profissional inválido.' });
    }
    const duracao = servicos.reduce((t, s) => t + cfg.servicos[s].min, 0);
    const total = servicos.reduce((t, s) => t + cfg.servicos[s].preco, 0);
    if (!horarioValido(cfg, data, hora, duracao)) return responder(res, 400, { erro: 'Esse horário não está disponível.' });

    // 5 a cada 15 minutos e 10 por dia, por IP
    if (!(await limitar(req, 'agendar', 5, 15)) || !(await limitar(req, 'agendar-dia', 10, 1440))) {
      return responder(res, 429, { erro: 'Muitas tentativas seguidas. Espere alguns minutos ou chame no WhatsApp.' });
    }
    const sql = db();

    // no máximo 3 horários futuros em aberto por conta
    const [{ n }] = await sql`
      select count(*)::int as n from agendamentos
      where (conta_id = ${conta.id} or telefone = ${telefone}) and status in ('pendente', 'confirmado') and inicio > now()`;
    if (n >= 3) return responder(res, 429, { erro: 'Você já tem 3 horários marcados. Chame no WhatsApp para mudar algum.' });

    const inicio = instante(data, hora);
    const fim = instante(data, hhmm(minutos(hora) + duracao));
    const candidatos = equipe.includes(pedido) ? [pedido] : equipe;

    // a mesma pessoa não marca dois horários que se cruzam
    const [cruza] = await sql`
      select 1 from agendamentos
      where conta_id = ${conta.id} and status in ('pendente', 'confirmado')
        and tstzrange(inicio, fim) && tstzrange(${inicio}::timestamptz, ${fim}::timestamptz)`;
    if (cruza) return responder(res, 409, { erro: 'Você já tem um horário marcado nesse período.' });

    // pausas e folgas marcadas no painel para esse intervalo
    const bloqueios = await sql`
      select profissional from bloqueios
      where tstzrange(inicio, fim) && tstzrange(${inicio}::timestamptz, ${fim}::timestamptz)`;
    const bloqueado = (p) => bloqueios.some((x) => x.profissional === null || x.profissional === p);

    // tenta cada profissional; a regra "exclude" do banco impede dois horários sobrepostos
    for (const profissional of candidatos.filter((p) => !bloqueado(p))) {
      try {
        const [linha] = await sql`
          insert into agendamentos (nome, telefone, servicos, profissional, inicio, fim, total, conta_id)
          values (${conta.nome}, ${telefone}, ${servicos}, ${profissional}, ${inicio}::timestamptz, ${fim}::timestamptz, ${total}, ${conta.id})
          returning id`;
        return responder(res, 201, { ok: true, id: Number(linha.id), profissional });
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

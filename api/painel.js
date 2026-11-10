/* /api/painel · tudo do painel (painel.html). Precisa estar logado como admin ou barbeiro.

   GET ?ver=inicio                       conta, serviços, horários, pausas e equipe
   GET ?ver=resumo                       faturamento por dia (400 dias), serviços e barbeiros por mês   (admin)
   GET ?ver=agenda&data=AAAA-MM-DD       horários marcados e bloqueios do dia (barbeiro: só os dele)
   GET ?ver=atendimentos&de=…&ate=…      atendimentos lançados no período                              (admin)

   POST { acao, ... }  (todas só admin, menos "foto" da própria conta)
     lancar         { servico, quantidade, profissional, data, hora?, valor? }
     apagarAtendimento { id }
     status         { id, status }   concluido lança o atendimento; voltar atrás tira
     precos         { servicos: { nome: { preco, min } } }
     horarios       { horarios: { 0: ['09:00','15:00'] | null, ... }, pausas: { 2: [['16:00','17:00']] } }
     bloquear       { data, inicio?, fim?, profissional?, motivo? }   sem inicio/fim = dia inteiro
     desbloquear    { id }
     criarMembro    { nome, email, senha, atende, area }
     editarMembro   { id, nome?, atende?, ativo?, area? }   área: masculino | feminino | ambos
     senhaMembro    { id, senha }
     foto           { id, imagem: "data:image/webp;base64,..." | null }
     zerar2fa       { id }   alguém da equipe perdeu o celular: desliga o 2FA dele (ativa de novo no próximo acesso) */
import {
  db, responder, corpo, limpar, contaDaSessao, getConfig, salvarConfig, profissionais, hashSenha, senhaValida,
  normalizarEmail, emailValido, ehData, ehHora, minutos, instante, agoraSP, diasEntre, somarDias, SERVICOS_PADRAO, AREAS,
} from './_lib.js';

const FUSO = 'America/Sao_Paulo';
const STATUS = ['pendente', 'confirmado', 'cancelado', 'concluido', 'faltou'];
const erro = (res, status, txt) => responder(res, status, { erro: txt });

export default async function handler(req, res) {
  try {
    const conta = await contaDaSessao(req);
    if (!conta) return erro(res, 401, 'Entre na sua conta.');
    if (conta.papel === 'cliente') return erro(res, 403, 'Esta área é só da equipe.');
    // senha provisória: primeiro cria a própria (entrar.html mostra a tela para isso)
    if (conta.trocarSenha) return responder(res, 403, { erro: 'Crie sua senha antes de usar o painel.', trocarSenha: true });
    if (conta.configurar2fa) return responder(res, 403, { erro: 'Ative a verificação em duas etapas antes de usar o painel.', configurar2fa: true });
    const admin = conta.papel === 'admin';

    if (req.method === 'GET') {
      const ver = String(req.query?.ver || '');
      if (ver === 'inicio') return await inicio(res, conta);
      if (ver === 'agenda') return await agenda(req, res, conta);
      if (!admin) return erro(res, 403, 'Só a administração vê isso.');
      if (ver === 'resumo') return await resumo(res);
      if (ver === 'atendimentos') return await atendimentos(req, res);
      return erro(res, 400, 'Pedido inválido.');
    }
    if (req.method !== 'POST') return erro(res, 405, 'Método não permitido.');
    const b = corpo(req);
    if (!b) return erro(res, 400, 'Dados inválidos.');
    if (b.acao === 'foto' && Number(b.id) === conta.id) return await foto(res, b, conta);
    if (!admin) return erro(res, 403, 'Só a administração pode mudar isso.');
    const acoes = { lancar, apagarAtendimento, status, precos, horarios, bloquear, desbloquear, criarMembro, editarMembro, senhaMembro, foto, zerar2fa };
    const fn = Object.hasOwn(acoes, b.acao) ? acoes[b.acao] : null;
    if (!fn) return erro(res, 400, 'Ação inválida.');
    return await fn(res, b, conta);
  } catch (e) {
    console.error('painel', e);
    return erro(res, 500, 'Não foi possível agora. Tente de novo.');
  }
}

/* ---------- leitura ---------- */
async function equipe() {
  const linhas = await db()`
    select id, nome, email, papel, atende, ativo, area, totp_ativo, foto_versao, (foto is not null) as tem_foto,
           to_char(criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as desde
    from contas where papel <> 'cliente'
    order by ativo desc, (papel = 'admin') desc, nome`;
  return linhas.map((m) => ({
    id: Number(m.id), nome: m.nome, email: m.email, papel: m.papel, atende: m.atende, ativo: m.ativo, area: m.area, desde: m.desde,
    doisFatores: Boolean(m.totp_ativo),
    foto: m.tem_foto ? `/api/foto?id=${m.id}&v=${m.foto_versao}` : null,
  }));
}

async function inicio(res, conta) {
  const cfg = await getConfig();
  return responder(res, 200, {
    conta,
    hoje: agoraSP().data,
    servicos: Object.entries(cfg.servicos).map(([nome, s]) => ({ nome, preco: s.preco, min: s.min, area: s.area })),
    horarios: cfg.horarios,
    pausas: cfg.pausas,
    profissionais: (await profissionais()).map((p) => p.nome),
    equipe: conta.papel === 'admin' ? await equipe() : [],
  });
}

async function resumo(res) {
  const sql = db();
  const dias = await sql`
    select to_char((quando at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as dia,
           sum(valor)::int as total, count(*)::int as qtd
    from atendimentos where quando >= now() - interval '400 days'
    group by 1 order by 1`;
  const servicos = await sql`
    select to_char(quando at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes, s as servico, count(*)::int as qtd
    from atendimentos, unnest(servicos) as s
    where quando >= now() - interval '70 days'
    group by 1, 2`;
  const barbeiros = await sql`
    select to_char(quando at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes, profissional,
           sum(valor)::int as total, count(*)::int as qtd
    from atendimentos where quando >= now() - interval '70 days'
    group by 1, 2`;
  return responder(res, 200, { hoje: agoraSP().data, dias, servicos, barbeiros });
}

async function agenda(req, res, conta) {
  const data = String(req.query?.data || '');
  if (!ehData(data)) return erro(res, 400, 'Data inválida.');
  const sql = db();
  const so = conta.papel === 'admin' ? null : conta.nome; // barbeiro vê só a agenda dele
  const dia0 = `${data}T00:00:00-03:00`;
  const marcados = await sql`
    select a.id, a.nome, a.telefone, a.servicos, a.profissional, a.total, a.status,
           to_char(a.inicio at time zone ${FUSO}, 'HH24:MI') as inicio,
           to_char(a.fim at time zone ${FUSO}, 'HH24:MI') as fim,
           c.email
    from agendamentos a left join contas c on c.id = a.conta_id
    where a.inicio >= ${dia0}::timestamptz and a.inicio < ${dia0}::timestamptz + interval '1 day'
      and (${so}::text is null or a.profissional = ${so})
    order by a.inicio, a.profissional`;
  const bloqueios = await sql`
    select id, profissional, motivo,
           to_char(inicio at time zone ${FUSO}, 'YYYY-MM-DD HH24:MI') as inicio,
           to_char(fim at time zone ${FUSO}, 'YYYY-MM-DD HH24:MI') as fim
    from bloqueios
    where tstzrange(inicio, fim) && tstzrange(${dia0}::timestamptz, ${dia0}::timestamptz + interval '1 day')
      and (${so}::text is null or profissional is null or profissional = ${so})
    order by inicio`;
  return responder(res, 200, {
    data,
    agendamentos: marcados.map((a) => ({ ...a, id: Number(a.id) })),
    bloqueios: bloqueios.map((x) => ({ ...x, id: Number(x.id) })),
  });
}

async function atendimentos(req, res) {
  const de = String(req.query?.de || '');
  const ate = String(req.query?.ate || '');
  if (!ehData(de) || !ehData(ate) || diasEntre(de, ate) < 0 || diasEntre(de, ate) > 400) return erro(res, 400, 'Período inválido.');
  const linhas = await db()`
    select t.id, t.servicos, t.valor, t.profissional, t.agendamento_id,
           to_char(t.quando at time zone ${FUSO}, 'YYYY-MM-DD') as data,
           to_char(t.quando at time zone ${FUSO}, 'HH24:MI') as hora,
           a.nome as cliente
    from atendimentos t left join agendamentos a on a.id = t.agendamento_id
    where t.quando >= ${de + 'T00:00:00-03:00'}::timestamptz
      and t.quando < ${ate + 'T00:00:00-03:00'}::timestamptz + interval '1 day'
    order by t.quando desc, t.id desc
    limit 1000`;
  return responder(res, 200, {
    atendimentos: linhas.map((l) => ({ ...l, id: Number(l.id), agendamento_id: l.agendamento_id && Number(l.agendamento_id) })),
  });
}

/* ---------- atendimentos e agenda ---------- */
async function lancar(res, b, conta) {
  const cfg = await getConfig();
  const servico = String(b.servico || '');
  const qtd = Number(b.quantidade ?? 1);
  const equipeNomes = (await profissionais()).map((p) => p.nome);
  const profissional = limpar(b.profissional, 80);
  const data = String(b.data || '');
  const hoje = agoraSP();
  if (!cfg.servicos[servico]) return erro(res, 400, 'Escolha o serviço.');
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 30) return erro(res, 400, 'Quantidade entre 1 e 30.');
  if (!equipeNomes.includes(profissional)) return erro(res, 400, 'Escolha quem atendeu.');
  if (!ehData(data) || diasEntre(data, hoje.data) < 0 || diasEntre(data, hoje.data) > 90) {
    return erro(res, 400, 'A data precisa ser de hoje ou dos últimos 90 dias.');
  }
  const hora = ehHora(b.hora) ? b.hora : (data === hoje.data ? null : '12:00');
  const valor = b.valor === undefined || b.valor === '' || b.valor === null ? cfg.servicos[servico].preco : Number(b.valor);
  if (!Number.isInteger(valor) || valor < 0 || valor > 10000) return erro(res, 400, 'Valor inválido (em reais, sem centavos).');
  const quando = hora ? instante(data, hora) : new Date().toISOString();
  await db()`
    insert into atendimentos (quando, servicos, valor, profissional, lancado_por)
    select ${quando}::timestamptz, ${[servico]}, ${valor}, ${profissional}, ${conta.id}
    from generate_series(1, ${qtd})`;
  return responder(res, 201, { ok: true });
}

async function apagarAtendimento(res, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return erro(res, 400, 'Atendimento inválido.');
  const sql = db();
  const [t] = await sql`delete from atendimentos where id = ${id} returning agendamento_id`;
  if (!t) return erro(res, 404, 'Esse atendimento não existe mais.');
  // se veio de um agendamento, ele volta a ficar "confirmado"
  if (t.agendamento_id) await sql`update agendamentos set status = 'confirmado' where id = ${t.agendamento_id} and status = 'concluido'`;
  return responder(res, 200, { ok: true });
}

async function status(res, b, conta) {
  const id = Number(b.id);
  const novo = String(b.status || '');
  if (!Number.isInteger(id) || !STATUS.includes(novo)) return erro(res, 400, 'Pedido inválido.');
  const sql = db();
  let a;
  try {
    [a] = await sql`update agendamentos set status = ${novo} where id = ${id} returning id, inicio, servicos, total, profissional`;
  } catch (e) {
    if (e?.code === '23P01') return erro(res, 409, 'Esse horário já foi ocupado por outro cliente.');
    throw e;
  }
  if (!a) return erro(res, 404, 'Agendamento não encontrado.');
  if (novo === 'concluido') {
    await sql`
      insert into atendimentos (quando, servicos, valor, profissional, agendamento_id, lancado_por)
      values (${a.inicio}, ${a.servicos}, ${a.total}, ${a.profissional}, ${a.id}, ${conta.id})
      on conflict (agendamento_id) do nothing`;
  } else {
    await sql`delete from atendimentos where agendamento_id = ${a.id}`;
  }
  return responder(res, 200, { ok: true });
}

async function bloquear(res, b) {
  const data = String(b.data || '');
  const hoje = agoraSP().data;
  if (!ehData(data) || diasEntre(hoje, data) < -1 || diasEntre(hoje, data) > 365) return erro(res, 400, 'Escolha uma data de hoje em diante.');
  const diaInteiro = !b.inicio && !b.fim;
  if (!diaInteiro && (!ehHora(b.inicio) || !ehHora(b.fim) || minutos(b.fim) <= minutos(b.inicio))) {
    return erro(res, 400, 'O fim precisa ser depois do início.');
  }
  const profissional = b.profissional ? limpar(b.profissional, 80) : null;
  if (profissional && !(await profissionais()).some((p) => p.nome === profissional)) return erro(res, 400, 'Profissional inválido.');
  const motivo = limpar(b.motivo, 80) || null;
  const inicio = instante(data, diaInteiro ? '00:00' : b.inicio);
  const fim = diaInteiro ? instante(somarDias(data, 1), '00:00') : instante(data, b.fim);
  await db()`
    insert into bloqueios (profissional, inicio, fim, motivo)
    values (${profissional}, ${inicio}::timestamptz, ${fim}::timestamptz, ${motivo})`;
  return responder(res, 201, { ok: true });
}

async function desbloquear(res, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return erro(res, 400, 'Pedido inválido.');
  await db()`delete from bloqueios where id = ${id}`;
  return responder(res, 200, { ok: true });
}

/* ---------- preços e horários ---------- */
async function precos(res, b) {
  const novos = b.servicos;
  if (!novos || typeof novos !== 'object') return erro(res, 400, 'Dados inválidos.');
  const limpo = {};
  for (const nome of Object.keys(SERVICOS_PADRAO)) {
    const s = novos[nome];
    if (!s) continue;
    const preco = Number(s.preco);
    const min = Number(s.min);
    if (!Number.isInteger(preco) || preco < 0 || preco > 5000) return erro(res, 400, `Preço inválido em ${nome}.`);
    if (!Number.isInteger(min) || min < 5 || min > 480 || min % 5) return erro(res, 400, `Duração de ${nome}: de 5 em 5 minutos.`);
    limpo[nome] = { preco, min };
  }
  const atual = (await getConfig()).servicos;
  await salvarConfig('servicos', { ...atual, ...limpo });
  return responder(res, 200, { ok: true });
}

async function horarios(res, b) {
  const h = b.horarios;
  const p = b.pausas || {};
  if (!h || typeof h !== 'object' || typeof p !== 'object') return erro(res, 400, 'Dados inválidos.');
  const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const horas = {};
  const pausas = {};
  for (let d = 0; d < 7; d++) {
    const dia = h[d];
    if (dia === null || dia === undefined) { horas[d] = null; continue; }
    if (!Array.isArray(dia) || !ehHora(dia[0]) || !ehHora(dia[1]) || minutos(dia[1]) - minutos(dia[0]) < 30) {
      return erro(res, 400, `Confira o horário de ${NOMES[d]}: o fechamento precisa ser depois da abertura.`);
    }
    if (minutos(dia[0]) % 5 || minutos(dia[1]) % 5) return erro(res, 400, `Use horários de 5 em 5 minutos (${NOMES[d]}).`);
    horas[d] = [dia[0], dia[1]];
    const lista = Array.isArray(p[d]) ? p[d].slice(0, 3) : [];
    for (const par of lista) {
      if (!Array.isArray(par) || !ehHora(par[0]) || !ehHora(par[1]) || minutos(par[1]) <= minutos(par[0])
        || minutos(par[0]) < minutos(dia[0]) || minutos(par[1]) > minutos(dia[1])) {
        return erro(res, 400, `A pausa de ${NOMES[d]} precisa ficar dentro do expediente.`);
      }
    }
    if (lista.length) pausas[d] = lista.map(([a, z]) => [a, z]);
  }
  await salvarConfig('horarios', horas);
  await salvarConfig('pausas', pausas);
  return responder(res, 200, { ok: true });
}

/* ---------- equipe ---------- */
async function criarMembro(res, b) {
  const nome = limpar(b.nome, 80);
  const email = normalizarEmail(b.email);
  if (nome.length < 2) return erro(res, 400, 'Informe o nome.');
  if (!emailValido(email)) return erro(res, 400, 'Confira o e-mail.');
  if (!senhaValida(b.senha)) return erro(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
  const area = AREAS.includes(b.area) ? b.area : 'masculino';
  const senha_hash = await hashSenha(b.senha);
  try {
    await db()`
      insert into contas (nome, email, senha_hash, papel, atende, area, trocar_senha)
      values (${nome}, ${email}, ${senha_hash}, 'barbeiro', ${b.atende !== false}, ${area}, true)`;
  } catch (e) {
    if (e?.code === '23505') return erro(res, 409, 'Já existe uma conta com esse e-mail ou alguém da equipe com esse nome.');
    throw e;
  }
  return responder(res, 201, { ok: true, equipe: await equipe() });
}

async function editarMembro(res, b, conta) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return erro(res, 400, 'Pedido inválido.');
  const sql = db();
  const [m] = await sql`select id, nome, papel from contas where id = ${id} and papel <> 'cliente'`;
  if (!m) return erro(res, 404, 'Pessoa não encontrada.');
  if (id === conta.id && b.ativo === false) return erro(res, 400, 'Você não pode desativar a sua própria conta.');

  if (b.nome !== undefined) {
    const nome = limpar(b.nome, 80);
    if (nome.length < 2) return erro(res, 400, 'Informe o nome.');
    if (nome !== m.nome) {
      try {
        await sql`update contas set nome = ${nome} where id = ${id}`;
      } catch (e) {
        if (e?.code === '23505') return erro(res, 409, 'Já tem alguém da equipe com esse nome.');
        throw e;
      }
      // a agenda guarda o nome: o histórico acompanha a troca
      await sql`update agendamentos set profissional = ${nome} where profissional = ${m.nome}`;
      await sql`update atendimentos set profissional = ${nome} where profissional = ${m.nome}`;
      await sql`update bloqueios set profissional = ${nome} where profissional = ${m.nome}`;
    }
  }
  if (typeof b.atende === 'boolean') await sql`update contas set atende = ${b.atende} where id = ${id}`;
  if (AREAS.includes(b.area)) await sql`update contas set area = ${b.area} where id = ${id}`;
  if (typeof b.ativo === 'boolean') {
    await sql`update contas set ativo = ${b.ativo} where id = ${id}`;
    if (!b.ativo) await sql`delete from sessoes where conta_id = ${id}`; // sai na hora
  }
  return responder(res, 200, { ok: true, equipe: await equipe() });
}

async function senhaMembro(res, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return erro(res, 400, 'Pedido inválido.');
  if (!senhaValida(b.senha)) return erro(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
  const sql = db();
  const [m] = await sql`update contas set senha_hash = ${await hashSenha(b.senha)}, trocar_senha = true where id = ${id} and papel = 'barbeiro' returning id`;
  if (!m) return erro(res, 404, 'Só dá para trocar a senha de barbeiros.');
  await sql`delete from sessoes where conta_id = ${id}`;
  return responder(res, 200, { ok: true });
}

async function foto(res, b, conta) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return erro(res, 400, 'Pedido inválido.');
  const imagem = b.imagem === null ? null : String(b.imagem || '');
  // a foto chega já reduzida pelo navegador (320 px): bem menos de 200 KB
  if (imagem !== null && (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(imagem) || imagem.length > 200000)) {
    return erro(res, 400, 'Foto inválida ou grande demais.');
  }
  const [m] = await db()`
    update contas set foto = ${imagem}, foto_versao = foto_versao + 1
    where id = ${id} and papel <> 'cliente' returning id`;
  if (!m) return erro(res, 404, 'Pessoa não encontrada.');
  return responder(res, 200, { ok: true, equipe: conta.papel === 'admin' ? await equipe() : [] });
}

// alguém da equipe trocou/perdeu o celular: o 2FA dele é desligado e ele ativa de novo ao entrar
async function zerar2fa(res, b, conta) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return erro(res, 400, 'Pedido inválido.');
  if (id === conta.id) return erro(res, 400, 'Você não pode zerar a sua própria verificação. Use um código de recuperação.');
  const sql = db();
  const [m] = await sql`
    update contas set totp_ativo = false, totp_segredo = null, totp_pendente = null, totp_ultimo = 0, codigos_recuperacao = '{}'
    where id = ${id} and papel <> 'cliente' returning id`;
  if (!m) return erro(res, 404, 'Pessoa não encontrada.');
  await sql`delete from sessoes where conta_id = ${id}`; // sai de todos os aparelhos
  return responder(res, 200, { ok: true, equipe: await equipe() });
}

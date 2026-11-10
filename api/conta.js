/* /api/conta · login de clientes, barbeiros e admin
   GET  → { conta, proximos }   (conta = null quando ninguém está logado)
   POST { acao: 'entrar',    email, senha }
        { acao: 'cadastrar', nome, email, telefone, senha }
        { acao: 'sair' }
        { acao: 'esqueci',   email }          → manda o link por e-mail (Resend)
        { acao: 'redefinir', token, senha }   → troca a senha e já entra
        { acao: 'trocarSenha', senha }        → logado com senha provisória: cria a própria
        { acao: 'verificar2fa', codigo }      → depois da senha: código do app ou de recuperação
        { acao: 'iniciar2fa' }                → equipe: gera o segredo/QR para ativar
        { acao: 'ativar2fa', codigo }         → confirma o primeiro código e liga (devolve os códigos de recuperação)

   Equipe (admin e barbeiros) sempre usa verificação em duas etapas: na primeira vez o site obriga
   a ativar; depois, quem acerta a senha recebe uma sessão 'falta2fa' até digitar o código.

   O admin é o e-mail da variável ADMIN_EMAIL. Ninguém consegue criar conta com
   ele pelo cadastro. Primeiro acesso, de um destes jeitos:
   - entrar com o ADMIN_EMAIL e a senha provisória da variável ADMIN_SENHA_INICIAL: a conta
     nasce aí e o site obriga a criar a senha dele na hora (depois disso a variável não vale mais);
   - ou "Esqueci minha senha", que manda o link para o e-mail (precisa do Resend). */
import {
  db, responder, corpo, limitar, limpar, hashSenha, conferirSenha, hashDeMentira, senhaValida,
  normalizarEmail, emailValido, emailAdmin, abrirSessao, fecharSessao, contaDaSessao, contaPorId,
  tokenAleatorio, hashToken, enviarEmail, urlSite, PROFISSIONAL_PADRAO,
  sessaoFalta2fa, completarSessao, novoSegredoTotp, uriTotp, conferirTotp, novosCodigosRecuperacao, hashRecuperacao,
} from './_lib.js';
import { timingSafeEqual, createHash } from 'node:crypto';

// compara a senha provisória do admin sem vazar nada pelo tempo de resposta
const igual = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

const GENERICO = 'Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha. Confira também o spam.';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await quemSou(req, res);
    if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });
    const b = corpo(req);
    if (!b) return responder(res, 400, { erro: 'Dados inválidos.' });
    switch (b.acao) {
      case 'entrar': return await entrar(req, res, b);
      case 'cadastrar': return await cadastrar(req, res, b);
      case 'sair': await fecharSessao(req, res); return responder(res, 200, { ok: true });
      case 'esqueci': return await esqueci(req, res, b);
      case 'redefinir': return await redefinir(req, res, b);
      case 'trocarSenha': return await trocarSenha(req, res, b);
      case 'verificar2fa': return await verificar2fa(req, res, b);
      case 'iniciar2fa': return await iniciar2fa(req, res);
      case 'ativar2fa': return await ativar2fa(req, res, b);
      default: return responder(res, 400, { erro: 'Ação inválida.' });
    }
  } catch (e) {
    console.error('conta', e);
    return responder(res, 500, { erro: 'Não foi possível agora. Tente de novo em instantes.' });
  }
}

async function quemSou(req, res) {
  const conta = await contaDaSessao(req);
  // acertou a senha e recarregou a página antes de digitar o código do app
  if (!conta && (await sessaoFalta2fa(req))) return responder(res, 200, { conta: null, precisa2fa: true });
  return responderConta(res, conta);
}

// senha certa: equipe com 2FA ligado ainda precisa do código; o resto entra direto
async function entrarDepoisDaSenha(res, id) {
  const [c] = await db()`select papel, totp_ativo from contas where id = ${id}`;
  if (c.papel !== 'cliente' && c.totp_ativo) {
    await abrirSessao(res, id, 'falta2fa');
    return responder(res, 200, { conta: null, precisa2fa: true });
  }
  await abrirSessao(res, id);
  return responderConta(res, await contaPorId(id));
}

// resposta padrão: a conta e, para quem tem, os próximos horários marcados
async function responderConta(res, conta) {
  if (!conta) return responder(res, 200, { conta: null });
  const proximos = await db()`
    select id, servicos, profissional, total, status,
           to_char(inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data,
           to_char(inicio at time zone 'America/Sao_Paulo', 'HH24:MI') as hora
    from agendamentos
    where conta_id = ${conta.id} and status in ('pendente', 'confirmado') and inicio > now()
    order by inicio limit 5`;
  return responder(res, 200, { conta, proximos: proximos.map((p) => ({ ...p, id: Number(p.id) })) });
}

async function entrar(req, res, b) {
  const email = normalizarEmail(b.email);
  const senha = typeof b.senha === 'string' ? b.senha : '';
  if (!emailValido(email) || !senha) return responder(res, 400, { erro: 'Preencha e-mail e senha.' });
  // 10 tentativas a cada 15 min por IP e 8 por conta (contra quem tenta adivinhar senha)
  if (!(await limitar(req, 'entrar', 10, 15)) || !(await limitar(req, 'entrar-email', 8, 15, email))) {
    return responder(res, 429, { erro: 'Muitas tentativas. Espere 15 minutos ou use "Esqueci minha senha".' });
  }
  const [c] = await db()`select id, senha_hash, ativo from contas where email = ${email}`;
  const certa = await conferirSenha(senha, c?.senha_hash || (await hashDeMentira()));
  // primeiro acesso do admin: a conta ainda não existe e ele entrou com a senha provisória da variável
  const inicial = process.env.ADMIN_SENHA_INICIAL || '';
  if (!c && email === emailAdmin() && inicial.length >= 8 && igual(senha, inicial)) {
    const nome = limpar(process.env.ADMIN_NOME, 80) || PROFISSIONAL_PADRAO;
    const [novo] = await db()`
      insert into contas (nome, email, senha_hash, papel, atende, area, trocar_senha)
      values (${nome}, ${email}, ${await hashSenha(inicial)}, 'admin', true, 'masculino', true)
      on conflict (email) do nothing
      returning id`;
    if (novo) {
      await abrirSessao(res, novo.id);
      return responderConta(res, await contaPorId(novo.id));
    }
  }
  if (!c || !certa || !c.ativo) return responder(res, 401, { erro: 'E-mail ou senha incorretos.' });
  return entrarDepoisDaSenha(res, c.id);
}

async function cadastrar(req, res, b) {
  const nome = limpar(b.nome, 80);
  const email = normalizarEmail(b.email);
  const telefone = String(b.telefone ?? '').replace(/\D/g, '');
  if (nome.length < 2) return responder(res, 400, { erro: 'Informe seu nome.' });
  if (!emailValido(email)) return responder(res, 400, { erro: 'Confira o e-mail.' });
  if (telefone.length < 10 || telefone.length > 13) return responder(res, 400, { erro: 'Confira o WhatsApp: DDD + número.' });
  if (!senhaValida(b.senha)) return responder(res, 400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (email === emailAdmin()) {
    return responder(res, 400, { erro: 'Esse e-mail é da administração. Para o primeiro acesso, use "Esqueci minha senha".' });
  }
  if (!(await limitar(req, 'cadastrar', 5, 60))) return responder(res, 429, { erro: 'Muitas contas criadas daqui. Tente mais tarde.' });
  const senha_hash = await hashSenha(b.senha);
  try {
    const [c] = await db()`
      insert into contas (nome, email, telefone, senha_hash)
      values (${nome}, ${email}, ${telefone}, ${senha_hash}) returning id`;
    await abrirSessao(res, c.id);
    return responderConta(res, await contaPorId(c.id));
  } catch (e) {
    if (e?.code === '23505') return responder(res, 409, { erro: 'Já existe uma conta com esse e-mail. Entre com a sua senha.' });
    throw e;
  }
}

async function esqueci(req, res, b) {
  const email = normalizarEmail(b.email);
  if (!emailValido(email)) return responder(res, 400, { erro: 'Confira o e-mail.' });
  if (!(await limitar(req, 'esqueci', 5, 60)) || !(await limitar(req, 'esqueci-email', 3, 60, email))) {
    return responder(res, 429, { erro: 'Muitos pedidos seguidos. Espere um pouco e confira seu e-mail.' });
  }
  const sql = db();
  const [c] = await sql`select id, nome, ativo from contas where email = ${email}`;
  const primeiroAcessoAdmin = !c && email === emailAdmin();
  // a resposta é a mesma tendo conta ou não (não entrega quem tem conta)
  if ((!c || !c.ativo) && !primeiroAcessoAdmin) return responder(res, 200, { ok: true, mensagem: GENERICO });

  const token = tokenAleatorio();
  await sql`update redefinicoes set usado = true where email = ${email} and not usado`;
  await sql`
    insert into redefinicoes (token_hash, conta_id, email, expira_em)
    values (${hashToken(token)}, ${c?.id ?? null}, ${email}, now() + interval '1 hour')`;
  const link = `${urlSite()}/entrar.html#redefinir=${token}`;
  const ola = c ? `Olá, ${c.nome.split(' ')[0]}!` : 'Olá!';
  const acao = primeiroAcessoAdmin ? 'criar a senha do painel do Império Dantas' : 'criar uma nova senha no site do Império Dantas';
  await enviarEmail({
    para: email,
    assunto: primeiroAcessoAdmin ? 'Seu acesso ao painel do Império Dantas' : 'Nova senha · Império Dantas',
    texto: `${ola}\n\nPara ${acao}, abra o link abaixo (vale por 1 hora):\n${link}\n\nSe não foi você que pediu, ignore este e-mail.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">
      <p>${ola}</p><p>Para ${acao}, toque no botão abaixo. O link vale por 1 hora.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#000;color:#fff;text-decoration:none;border-radius:999px">Criar nova senha</a></p>
      <p style="color:#555;font-size:14px">Se não foi você que pediu, ignore este e-mail. Sua senha continua a mesma.</p></div>`,
  });
  return responder(res, 200, { ok: true, mensagem: GENERICO });
}

async function redefinir(req, res, b) {
  const token = typeof b.token === 'string' ? b.token : '';
  if (!token || token.length > 100) return responder(res, 400, { erro: 'Link inválido. Peça um novo em "Esqueci minha senha".' });
  if (!senhaValida(b.senha)) return responder(res, 400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (!(await limitar(req, 'redefinir', 10, 15))) return responder(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
  const sql = db();
  // marca como usado na mesma consulta que confere: o mesmo link não serve duas vezes
  const [r] = await sql`
    update redefinicoes set usado = true
    where token_hash = ${hashToken(token)} and not usado and expira_em > now()
    returning conta_id, email`;
  if (!r) return responder(res, 400, { erro: 'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".' });
  const senha_hash = await hashSenha(b.senha);

  let id = r.conta_id;
  if (id) {
    await sql`update contas set senha_hash = ${senha_hash}, trocar_senha = false where id = ${id}`;
    await sql`delete from sessoes where conta_id = ${id}`; // quem estava logado com a senha velha sai
  } else {
    // primeiro acesso do admin: a conta nasce aqui
    if (r.email !== emailAdmin()) return responder(res, 400, { erro: 'Link inválido.' });
    const nome = limpar(process.env.ADMIN_NOME, 80) || PROFISSIONAL_PADRAO;
    const [c] = await sql`
      insert into contas (nome, email, senha_hash, papel, atende, area)
      values (${nome}, ${r.email}, ${senha_hash}, 'admin', true, 'masculino')
      on conflict (email) do update set senha_hash = excluded.senha_hash
      returning id`;
    id = c.id;
  }
  return entrarDepoisDaSenha(res, id);
}

// logado com senha provisória: cria a própria senha (e só então o painel libera)
async function trocarSenha(req, res, b) {
  const conta = await contaDaSessao(req);
  if (!conta) return responder(res, 401, { erro: 'Entre de novo para criar sua senha.' });
  if (!senhaValida(b.senha)) return responder(res, 400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (!(await limitar(req, 'trocar-senha', 10, 15))) return responder(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
  const sql = db();
  const [atual] = await sql`select senha_hash from contas where id = ${conta.id}`;
  if (await conferirSenha(b.senha, atual.senha_hash)) return responder(res, 400, { erro: 'Escolha uma senha diferente da provisória.' });
  await sql`update contas set senha_hash = ${await hashSenha(b.senha)}, trocar_senha = false where id = ${conta.id}`;
  return responderConta(res, await contaPorId(conta.id));
}

// segunda etapa do login: código de 6 números do app, ou um código de recuperação (uso único)
async function verificar2fa(req, res, b) {
  const pend = await sessaoFalta2fa(req);
  if (!pend) return responder(res, 401, { erro: 'Entre de novo com e-mail e senha.' });
  if (!(await limitar(req, '2fa', 8, 15, String(pend.contaId)))) {
    return responder(res, 429, { erro: 'Muitos códigos errados. Espere 15 minutos.' });
  }
  const sql = db();
  const [c] = await sql`select totp_segredo, totp_ultimo, codigos_recuperacao from contas where id = ${pend.contaId}`;
  const codigo = String(b.codigo ?? '').trim();
  let certo = false;
  const passo = conferirTotp(c.totp_segredo, codigo.replace(/\s/g, ''), c.totp_ultimo);
  if (passo !== null) {
    await sql`update contas set totp_ultimo = ${passo} where id = ${pend.contaId}`;
    certo = true;
  } else if (codigo.replace(/[^A-Za-z0-9]/g, '').length === 8) {
    const h = hashRecuperacao(codigo);
    // gasta o código na mesma consulta que confere (não serve duas vezes)
    const [usado] = await sql`
      update contas set codigos_recuperacao = array_remove(codigos_recuperacao, ${h})
      where id = ${pend.contaId} and ${h} = any(codigos_recuperacao) returning id`;
    certo = Boolean(usado);
  }
  if (!certo) return responder(res, 400, { erro: 'Código incorreto. Confira no app e tente de novo.' });
  await completarSessao(res, pend.token);
  return responderConta(res, await contaPorId(pend.contaId));
}

// ativação: gera um segredo novo (guardado como pendente até confirmar o primeiro código)
async function iniciar2fa(req, res) {
  const conta = await contaDaSessao(req);
  if (!conta) return responder(res, 401, { erro: 'Entre na sua conta.' });
  if (conta.papel === 'cliente') return responder(res, 403, { erro: 'Só para a equipe.' });
  if (conta.trocarSenha) return responder(res, 403, { erro: 'Crie sua senha antes.' });
  if (conta.doisFatores) return responder(res, 400, { erro: 'A verificação em duas etapas já está ativa.' });
  const segredo = novoSegredoTotp();
  await db()`update contas set totp_pendente = ${segredo} where id = ${conta.id}`;
  return responder(res, 200, { segredo, uri: uriTotp(segredo, conta.email) });
}

async function ativar2fa(req, res, b) {
  const conta = await contaDaSessao(req);
  if (!conta) return responder(res, 401, { erro: 'Entre na sua conta.' });
  if (conta.papel === 'cliente' || conta.doisFatores) return responder(res, 400, { erro: 'Nada para ativar.' });
  if (!(await limitar(req, '2fa-ativar', 10, 15, String(conta.id)))) return responder(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
  const sql = db();
  const [c] = await sql`select totp_pendente from contas where id = ${conta.id}`;
  const passo = conferirTotp(c.totp_pendente, String(b.codigo ?? '').replace(/\s/g, ''));
  if (passo === null) return responder(res, 400, { erro: 'Código incorreto. Confira se o app mostra "Império Dantas" e digite o código atual.' });
  const { codigos, hashes } = novosCodigosRecuperacao();
  await sql`
    update contas set totp_segredo = totp_pendente, totp_pendente = null, totp_ativo = true,
      totp_ultimo = ${passo}, codigos_recuperacao = ${hashes}
    where id = ${conta.id}`;
  // outras sessões abertas antes do 2FA saem (só fica esta, do aparelho que ativou)
  await sql`delete from sessoes where conta_id = ${conta.id} and token_hash <> ${hashToken(String(req.headers.cookie || '').match(/__Host-sessao=([^;]+)/)?.[1] || '')}`;
  return responder(res, 200, { codigos, conta: await contaPorId(conta.id) });
}

/* IMPÉRIO DANTAS · entrar.html (login, criar conta, esqueci e nova senha)
   Equipe (admin e barbeiro) vai direto para o painel depois de entrar. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const params = new URLSearchParams(location.search);
  const voltar = params.get('voltar');
  let token = '';

  async function conta(dados) {
    const r = await fetch('/api/conta', {
      method: dados ? 'POST' : 'GET',
      headers: dados ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: dados ? JSON.stringify(dados) : undefined,
      credentials: 'same-origin',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Não foi possível agora. Tente de novo.');
    return j;
  }

  function ir(tela, foco = true) {
    $$('[data-tela]').forEach((s) => { s.hidden = s.dataset.tela !== tela; });
    $$('[data-erro], [data-ok]').forEach((p) => { p.hidden = true; });
    const t = { entrar: 'Entrar', cadastrar: 'Criar conta', esqueci: 'Nova senha', redefinir: 'Crie sua senha', trocar: 'Crie sua senha',
      '2fa': 'Código de verificação', ativar2fa: 'Proteja o painel', codigos: 'Códigos de recuperação', conta: 'Minha conta' }[tela];
    document.title = `${t} · Império Dantas`;
    if (foco) $(`[data-tela="${tela}"] h1`).focus({ preventScroll: true });
    // leva o e-mail digitado de uma tela para a outra
    const email = $$('input[name="email"]').map((i) => i.value).find(Boolean);
    if (email) $$(`[data-tela="${tela}"] input[name="email"]`).forEach((i) => { if (!i.value) i.value = email; });
  }
  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.ir)));

  // depois de entrar: equipe vai para o painel; cliente volta para onde estava
  function seguir(r) {
    // senha certa, mas a equipe ainda precisa do código do app
    if (r.precisa2fa) { ir('2fa'); return; }
    // entrou com senha provisória (primeiro acesso): cria a própria antes de tudo
    if (r.conta.trocarSenha) { ir('trocar'); return; }
    // equipe sem a verificação em duas etapas: ativa agora
    if (r.conta.configurar2fa) { iniciarAtivacao(); return; }
    if (r.conta.papel !== 'cliente') { location.replace('painel.html'); return; }
    if (voltar === 'agendar') { location.replace('index.html#agendar'); return; }
    mostrarConta(r);
  }

  function mostrarConta({ conta: c, proximos = [] }) {
    $('[data-ola]').textContent = `Olá, ${c.nome.split(' ')[0]}`;
    $('[data-conta-email]').textContent = c.email;
    $('[data-ir-painel]').hidden = c.papel === 'cliente';
    $('[data-proximos]').innerHTML = proximos.length ? proximos.map((p) => {
      const d = new Date(p.data + 'T12:00:00Z');
      const txt = `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} às ${p.hora}`;
      return `<li>${txt}<small>${p.servicos.map(esc).join(' + ')} com ${esc(p.profissional)}</small></li>`;
    }).join('') : '<li>Nenhum horário marcado.<small>Quando marcar, ele aparece aqui.</small></li>';
    ir('conta', false);
  }
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // máscara do WhatsApp: (11) 91234-5678
  const tel = $('[data-form="cadastrar"] input[name="telefone"]');
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    tel.value = d.length > 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  // mostrar/esconder senha
  $$('[data-ver-senha]').forEach((b) => b.addEventListener('click', () => {
    const i = b.closest('.senha').querySelector('input');
    const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(ver));
    b.setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha');
  }));

  const conferir = {
    entrar: (f) => (!f.email.value.trim() || !f.senha.value ? 'Preencha e-mail e senha.' : ''),
    cadastrar: (f) => (f.nome.value.trim().length < 2 ? 'Escreva seu nome.'
      : f.telefone.value.replace(/\D/g, '').length < 10 ? 'Confira o WhatsApp: DDD + número.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()) ? 'Confira o e-mail.'
      : f.senha.value.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : ''),
    esqueci: (f) => (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()) ? 'Confira o e-mail.' : ''),
    redefinir: (f) => (f.senha.value.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : ''),
    '2fa': (f) => (f.codigo.value.replace(/[^A-Za-z0-9]/g, '').length < 6 ? 'Digite o código de 6 números do app.' : ''),
    ativar2fa: (f) => (!/^\d{6}$/.test(f.codigo.value.replace(/\s/g, '')) ? 'Digite o código de 6 números do app.' : ''),
    trocar: (f) => (f.senha.value.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.'
      : f.senha.value !== f.repetir.value ? 'As duas senhas não são iguais.' : ''),
  };

  $$('[data-form]').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = form.dataset.form;
    const f = form.elements;
    const erro = $('[data-erro]', form);
    const ok = $('[data-ok]', form);
    const bt = $('button[type="submit"]', form);
    erro.hidden = true;
    if (ok) ok.hidden = true;
    const problema = conferir[tipo](f);
    if (problema) { erro.textContent = problema; erro.hidden = false; return; }
    const txt = bt.textContent;
    bt.disabled = true;
    bt.textContent = 'Um momento...';
    try {
      if (tipo === 'entrar') seguir(await conta({ acao: 'entrar', email: f.email.value, senha: f.senha.value }));
      if (tipo === 'cadastrar') seguir(await conta({ acao: 'cadastrar', nome: f.nome.value, telefone: f.telefone.value, email: f.email.value, senha: f.senha.value }));
      if (tipo === 'trocar') seguir(await conta({ acao: 'trocarSenha', senha: f.senha.value }));
      if (tipo === '2fa') seguir(await conta({ acao: 'verificar2fa', codigo: f.codigo.value }));
      if (tipo === 'ativar2fa') mostrarCodigos(await conta({ acao: 'ativar2fa', codigo: f.codigo.value }));
      if (tipo === 'esqueci') { const r = await conta({ acao: 'esqueci', email: f.email.value }); ok.textContent = r.mensagem; ok.hidden = false; }
      if (tipo === 'redefinir') {
        const r = await conta({ acao: 'redefinir', token, senha: f.senha.value });
        history.replaceState(null, '', location.pathname); // tira o token da barra de endereço
        seguir(r);
      }
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
    }
    bt.disabled = false;
    bt.textContent = txt;
  }));

  // ----- verificação em duas etapas: ativação (QR code) e códigos de recuperação -----
  async function iniciarAtivacao() {
    let r;
    try { r = await conta({ acao: 'iniciar2fa' }); } catch (e) { ir('entrar'); return; }
    const caixa = $('[data-qr]');
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(r.uri);
      qr.make();
      caixa.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
    } else {
      caixa.hidden = true; // sem a biblioteca: fica só a chave para digitar
      $('[data-tela="ativar2fa"] .acesso__ajuda').open = true;
    }
    $('[data-segredo]').textContent = r.segredo.match(/.{1,4}/g).join(' ');
    ir('ativar2fa');
  }
  let depoisDosCodigos = null;
  function mostrarCodigos(r) {
    depoisDosCodigos = r;
    $('[data-codigos]').innerHTML = r.codigos.map((c) => `<li><code>${c}</code></li>`).join('');
    $('[data-guardei]').checked = false;
    $('[data-continuar]').disabled = true;
    ir('codigos');
  }
  $('[data-guardei]').addEventListener('change', (e) => { $('[data-continuar]').disabled = !e.target.checked; });
  $('[data-continuar]').addEventListener('click', () => { if (depoisDosCodigos) seguir({ conta: depoisDosCodigos.conta }); });
  $('[data-copiar-codigos]').addEventListener('click', async (e) => {
    const txt = `Império Dantas · códigos de recuperação\n${depoisDosCodigos.codigos.join('\n')}`;
    try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copiado'; } catch { e.target.textContent = 'Não deu para copiar: anote ou tire print'; }
  });

  $('[data-sair]').addEventListener('click', async () => {
    try { await conta({ acao: 'sair' }); } catch { /* sai de qualquer jeito */ }
    ir('entrar');
  });

  // começo: link do e-mail, ou já logado, ou tela pedida no endereço
  (async function iniciar() {
    const hash = location.hash.slice(1);
    if (hash.startsWith('redefinir=')) {
      token = decodeURIComponent(hash.slice(10));
      history.replaceState(null, '', location.pathname + location.search);
      ir('redefinir', false);
      return;
    }
    try {
      const r = await conta();
      if (r.precisa2fa) { ir('2fa', false); return; }
      if (r.conta?.trocarSenha) { ir('trocar', false); return; }
      if (r.conta?.configurar2fa) { iniciarAtivacao(); return; }
      if (r.conta) { if (voltar === 'painel' && r.conta.papel !== 'cliente') location.replace('painel.html'); else mostrarConta(r); return; }
    } catch { /* sem servidor: mostra o login mesmo assim */ }
    ir(['cadastrar', 'esqueci'].includes(hash) ? hash : 'entrar', false);
  })();
})();

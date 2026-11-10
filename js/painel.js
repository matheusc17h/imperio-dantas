/* =====================================================================
   IMPÉRIO DANTAS · painel da equipe
   Fala só com /api/painel e /api/conta. Admin vê tudo; barbeiro vê só a
   agenda dele. Sem login, volta para entrar.html.
   ===================================================================== */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const STATUS = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Não veio', cancelado: 'Cancelado' };
  const PAPEL = { admin: 'Administração', barbeiro: 'Barbeiro' };
  const AREAS = { masculino: 'Cabelo masculino', feminino: 'Cabelo feminino', ambos: 'Os dois' };
  const TITULOS = {
    inicio: ['Visão geral', ''],
    agenda: ['Agenda', 'Horários marcados pelo site'],
    atendimentos: ['Atendimentos', 'Tudo o que entrou no caixa'],
    horarios: ['Horários', 'Quando o salão abre e as pausas fixas'],
    precos: ['Preços', 'Valor e tempo de cada serviço'],
    equipe: ['Equipe', 'Quem atende e quem acessa o painel'],
  };

  const brl = (v) => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iniciais = (n) => String(n || '?').split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (nome, foto) => `<span class="avatar" aria-hidden="true">${foto ? `<img src="${esc(foto)}" alt="" width="64" height="64" loading="lazy">` : esc(iniciais(nome))}</span>`;
  const icone = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const telLink = (t) => `https://wa.me/55${String(t).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}`;
  const telTxt = (t) => { const d = String(t).replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };

  /* ---------- datas (sempre AAAA-MM-DD, contas em UTC para não depender do fuso do aparelho) ---------- */
  const dt = (iso) => new Date(iso + 'T12:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const somar = (s, n) => iso(new Date(dt(s).getTime() + n * 864e5));
  const semanaDe = (s) => dt(s).getUTCDay();
  const diasNoMes = (ano, mes) => new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const mesDe = (s) => s.slice(0, 7);
  const nomeMes = (ym, curto) => { const m = MESES[Number(ym.slice(5, 7)) - 1]; return curto ? m.slice(0, 3) : m; };
  const extenso = (s) => { const d = dt(s); return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
  const mesAnterior = (ym, n = 1) => { const [a, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 - n, 1)); return iso(d).slice(0, 7); };

  /* ---------- servidor ---------- */
  async function api(caminho, corpo) {
    const r = await fetch('/api/' + caminho, {
      method: corpo ? 'POST' : 'GET',
      headers: corpo ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
      credentials: 'same-origin',
    });
    if (r.status === 401) { location.replace('entrar.html?voltar=painel'); throw new Error('Sessão encerrada.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Não foi possível agora. Tente de novo.');
    return j;
  }
  const painel = (ver, extra = '') => api(`painel?ver=${ver}${extra}`);
  const acao = (dados) => api('painel', dados);

  /* ---------- aviso rápido ---------- */
  const toast = $('[data-toast]');
  let toastT;
  function avisar(txt, erro = false) {
    toast.textContent = txt;
    toast.classList.toggle('toast--erro', erro);
    toast.classList.add('mostrar');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('mostrar'), erro ? 4200 : 2600);
  }

  // botão ocupado enquanto salva (evita clique duplo)
  async function ocupado(bt, fn) {
    if (bt?.disabled) return;
    const txt = bt?.innerHTML;
    if (bt) { bt.disabled = true; bt.dataset.txt = txt; }
    try { return await fn(); } catch (e) { avisar(e.message, true); return undefined; } finally {
      if (bt) { bt.disabled = false; bt.innerHTML = txt; }
    }
  }

  /* ---------- estado ---------- */
  const E = {
    conta: null, admin: false, hoje: '', servicos: [], horarios: {}, pausas: {}, profissionais: [], equipe: [],
    resumo: null, diaAgenda: '', periodo: 'hoje', grafModo: 'meses',
  };

  /* ---------- menu (gaveta no celular e tablet) ---------- */
  const lateral = $('#lateral');
  const veu = $('.veu');
  const btMenu = $('[data-menu-abrir]');
  const gaveta = matchMedia('(max-width: 1023px)');
  function menu(abrir) {
    if (!gaveta.matches && abrir) return;
    lateral.classList.toggle('aberta', abrir);
    veu.classList.toggle('aberto', abrir);
    btMenu.setAttribute('aria-expanded', String(abrir));
    document.documentElement.classList.toggle('travado', abrir);
    if (abrir) lateral.querySelector('.menu a:not([hidden])')?.focus();
  }
  btMenu.addEventListener('click', () => menu(true));
  $$('[data-menu-fechar]').forEach((b) => b.addEventListener('click', () => { menu(false); btMenu.focus(); }));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && lateral.classList.contains('aberta')) { menu(false); btMenu.focus(); } });
  gaveta.addEventListener('change', () => menu(false));

  /* ---------- navegação entre seções (pelo #) ---------- */
  const secaoValida = (s) => TITULOS[s] && (E.admin || s === 'agenda');
  async function mostrar(nome, foco = false) {
    if (!secaoValida(nome)) nome = E.admin ? 'inicio' : 'agenda';
    $$('[data-secao]').forEach((s) => {
      const ativa = s.dataset.secao === nome;
      if (ativa && s.hidden) { s.classList.remove('entrando'); void s.offsetWidth; s.classList.add('entrando'); }
      s.hidden = !ativa;
    });
    $$('[data-secao-link]').forEach((a) => {
      if (a.dataset.secaoLink === nome) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const [titulo, sub] = TITULOS[nome];
    $('[data-titulo]').textContent = titulo;
    $('[data-subtitulo]').textContent = nome === 'inicio' ? extenso(E.hoje) : sub;
    document.title = `${titulo} · Painel · Império Dantas`;
    menu(false);
    if (foco) $('[data-titulo]').focus({ preventScroll: true });
    scrollTo({ top: 0 });
    if (nome === 'inicio') await carregarResumo();
    if (nome === 'agenda') await carregarAgenda();
    if (nome === 'atendimentos') await carregarAtendimentos();
    if (nome === 'horarios') montarHorarios();
    if (nome === 'precos') montarPrecos();
    if (nome === 'equipe') montarEquipe();
  }
  addEventListener('hashchange', () => mostrar(location.hash.slice(1), true));

  /* =====================================================================
     VISÃO GERAL
     ===================================================================== */
  async function carregarResumo() {
    try {
      const [r, ag] = await Promise.all([painel('resumo'), painel('agenda', `&data=${E.hoje}`)]);
      E.resumo = r;
      E.hoje = r.hoje;
      montarCartoes();
      montarSeletoresMes();
      desenharGrafico();
      montarRanking();
      $('[data-agenda-hoje]').innerHTML = linhasAgenda(ag.agendamentos, [], 'Nenhum horário marcado para hoje.');
    } catch (e) { avisar(e.message, true); }
  }

  function porDia() {
    const m = new Map();
    for (const d of E.resumo?.dias || []) m.set(d.dia, d);
    return m;
  }
  function soma(mapa, de, ate) {
    let total = 0;
    let qtd = 0;
    for (let d = de; d <= ate; d = somar(d, 1)) { const x = mapa.get(d); if (x) { total += x.total; qtd += x.qtd; } }
    return { total, qtd };
  }
  function delta(el, atual, antes) {
    el.className = 'delta';
    if (!antes) { el.textContent = ''; return; }
    const p = ((atual - antes) / antes) * 100;
    const txt = `${p > 0 ? '+' : ''}${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    el.textContent = txt;
    el.classList.add(p >= 0 ? 'delta--sobe' : 'delta--desce');
    el.setAttribute('aria-label', `${p >= 0 ? 'Subiu' : 'Caiu'} ${txt.replace('+', '').replace('-', '')}`);
  }

  function montarCartoes() {
    const m = porDia();
    const H = E.hoje;
    const c = (k) => $(`[data-c="${k}"]`);
    // hoje x ontem
    const hoje = soma(m, H, H);
    const ontem = soma(m, somar(H, -1), somar(H, -1));
    c('hoje-valor').textContent = brl(hoje.total);
    delta(c('hoje-delta'), hoje.total, ontem.total);
    c('hoje-pe').textContent = `${hoje.qtd} ${hoje.qtd === 1 ? 'atendimento' : 'atendimentos'}, ontem ${brl(ontem.total)}`;
    // semana (domingo até hoje) x mesmos dias da semana passada
    const ini = somar(H, -semanaDe(H));
    const sem = soma(m, ini, H);
    const semAnt = soma(m, somar(ini, -7), somar(H, -7));
    c('semana-valor').textContent = brl(sem.total);
    delta(c('semana-delta'), sem.total, semAnt.total);
    c('semana-pe').textContent = 'contra os mesmos dias da semana passada';
    // mês até hoje x mês passado até o mesmo dia
    const ym = mesDe(H);
    const ant = mesAnterior(ym);
    const [aa, ma] = ant.split('-').map(Number);
    const diaLim = Math.min(Number(H.slice(8)), diasNoMes(aa, ma - 1));
    const mes = soma(m, `${ym}-01`, H);
    const mesAnt = soma(m, `${ant}-01`, `${ant}-${String(diaLim).padStart(2, '0')}`);
    c('mes-valor').textContent = brl(mes.total);
    delta(c('mes-delta'), mes.total, mesAnt.total);
    c('mes-pe').textContent = `contra ${nomeMes(ant)} até o dia ${diaLim}`;
    // atendimentos no mês
    c('qtd-valor').textContent = mes.qtd.toLocaleString('pt-BR');
    delta(c('qtd-delta'), mes.qtd, mesAnt.qtd);
    c('qtd-pe').textContent = `ticket médio ${brl(mes.qtd ? mes.total / mes.qtd : 0)}`;
  }

  /* ---------- gráfico ---------- */
  const caixaGraf = $('[data-grafico]');
  const legenda = $('[data-grafico-legenda]');
  const selA = $('[data-mes-a]');
  const selB = $('[data-mes-b]');

  function mesesDisponiveis() {
    const lista = [];
    for (let i = 0; i < 13; i++) lista.push(mesAnterior(mesDe(E.hoje), i));
    return lista;
  }
  function montarSeletoresMes() {
    if (selA.options.length) return;
    const ops = mesesDisponiveis().map((ym) => `<option value="${ym}">${nomeMes(ym)[0].toUpperCase()}${nomeMes(ym).slice(1)} ${ym.slice(0, 4)}</option>`).join('');
    selA.innerHTML = ops;
    selB.innerHTML = ops;
    selA.selectedIndex = 0;
    selB.selectedIndex = 1;
  }
  [selA, selB].forEach((s) => s.addEventListener('change', desenharGrafico));
  $$('[data-graf-modo]').forEach((b) => b.addEventListener('click', () => {
    E.grafModo = b.dataset.grafModo;
    $$('[data-graf-modo]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('[data-comparar]').hidden = E.grafModo !== 'comparar';
    desenharGrafico();
  }));
  if ('ResizeObserver' in window) {
    let largura = 0;
    new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w !== largura) { largura = w; if (E.resumo && !$('[data-secao="inicio"]').hidden) desenharGrafico(); }
    }).observe(caixaGraf);
  }

  // números redondos para o eixo: 0, 2 mil, 4 mil...
  function escala(max) {
    if (max <= 0) return { topo: 100, passo: 25 };
    const bruto = max / 4;
    const p10 = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((k) => k >= bruto);
    return { topo: passo * 4, passo };
  }
  const curto = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(v)));
  const defs = `<defs>
    <linearGradient id="g-cromo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#B9BDC3"/><stop offset="1" stop-color="#7D8188"/></linearGradient>
    <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".18"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>`;

  function desenharGrafico() {
    if (!E.resumo) return;
    const W = caixaGraf.clientWidth;
    const Hh = caixaGraf.clientHeight;
    if (!W) return;
    if (E.grafModo === 'meses') graficoMeses(W, Hh); else graficoComparar(W, Hh);
  }

  function eixoY(W, Hh, m, topo, passo) {
    let g = '';
    for (let v = 0; v <= topo; v += passo) {
      const y = m.t + (Hh - m.t - m.b) * (1 - v / topo);
      g += `<line class="grade" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/><text x="${m.l - 8}" y="${y + 4}" text-anchor="end">${curto(v)}</text>`;
    }
    return g;
  }

  function graficoMeses(W, Hh) {
    const m = porDia();
    const meses = mesesDisponiveis().slice(0, W < 520 ? 6 : 12).reverse();
    const tot = meses.map((ym) => {
      let total = 0;
      let qtd = 0;
      for (const [d, x] of m) if (d.startsWith(ym)) { total += x.total; qtd += x.qtd; }
      return { ym, total, qtd };
    });
    const { topo, passo } = escala(Math.max(...tot.map((t) => t.total)));
    const mg = { t: 12, r: 4, b: 26, l: 46 };
    const larg = (W - mg.l - mg.r) / tot.length;
    const bw = Math.min(44, larg * 0.62);
    const alto = Hh - mg.t - mg.b;
    let svg = `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}">${defs}${eixoY(W, Hh, mg, topo, passo)}`;
    tot.forEach((t, i) => {
      const h = Math.max(t.total ? 2 : 0, (t.total / topo) * alto);
      const x = mg.l + i * larg + (larg - bw) / 2;
      const atual = i === tot.length - 1;
      svg += `<rect class="barra-mes${atual ? ' barra-mes--atual' : ''}" data-i="${i}" x="${x}" y="${mg.t + alto - h}" width="${bw}" height="${h}" rx="6"/>`;
      svg += `<text x="${x + bw / 2}" y="${Hh - 6}" text-anchor="middle">${nomeMes(t.ym, true)}</text>`;
    });
    caixaGraf.innerHTML = svg + '</svg>';
    caixaGraf.setAttribute('aria-label', 'Faturamento por mês: ' + tot.map((t) => `${nomeMes(t.ym)} ${brl(t.total)}`).join(', '));
    const melhor = tot.slice(0, -1).reduce((a, b) => (b.total > a.total ? b : a), { total: 0, ym: '' });
    const atual = tot[tot.length - 1];
    legenda.innerHTML = `${nomeMes(atual.ym)[0].toUpperCase()}${nomeMes(atual.ym).slice(1)} até agora: <b>${brl(atual.total)}</b>` + (melhor.ym ? `. Melhor mês: ${nomeMes(melhor.ym)}, com <b>${brl(melhor.total)}</b>` : '');

    // toque/mouse numa barra mostra o valor
    const mostrarDica = (i) => {
      $$('.barra-mes', caixaGraf).forEach((r) => r.classList.toggle('barra-mes--ativa', Number(r.dataset.i) === i));
      $('.dica', caixaGraf)?.remove();
      if (i < 0) return;
      const t = tot[i];
      const x = mg.l + i * larg + larg / 2;
      const d = document.createElement('div');
      d.className = 'dica';
      d.innerHTML = `<strong>${nomeMes(t.ym)[0].toUpperCase()}${nomeMes(t.ym).slice(1)} ${t.ym.slice(0, 4)}</strong><p>Faturado <b>${brl(t.total)}</b></p><p>Atendimentos <b>${t.qtd}</b></p>`;
      d.style.left = `${Math.min(Math.max(x, 80), W - 80)}px`;
      caixaGraf.append(d);
    };
    const indice = (e) => { const r = caixaGraf.getBoundingClientRect(); return Math.floor((e.clientX - r.left - mg.l) / larg); };
    caixaGraf.onpointermove = (e) => { const i = indice(e); mostrarDica(i >= 0 && i < tot.length ? i : -1); };
    caixaGraf.onpointerleave = () => mostrarDica(-1);
  }

  function graficoComparar(W, Hh) {
    const m = porDia();
    const A = selA.value;
    const B = selB.value;
    const serie = (ym) => {
      const [a, mm] = ym.split('-').map(Number);
      const n = diasNoMes(a, mm - 1);
      const ultimo = ym === mesDe(E.hoje) ? Number(E.hoje.slice(8)) : n; // mês atual: só até hoje
      const pts = [];
      let acc = 0;
      for (let d = 1; d <= n; d++) {
        acc += m.get(`${ym}-${String(d).padStart(2, '0')}`)?.total || 0;
        if (d <= ultimo) pts.push(acc);
      }
      return { ym, pts, n };
    };
    const sa = serie(A);
    const sb = serie(B);
    const nDias = Math.max(sa.n, sb.n);
    const { topo, passo } = escala(Math.max(sa.pts.at(-1) || 0, sb.pts.at(-1) || 0));
    const mg = { t: 12, r: 8, b: 26, l: 46 };
    const alto = Hh - mg.t - mg.b;
    const X = (d) => mg.l + ((d - 1) / (nDias - 1)) * (W - mg.l - mg.r);
    const Y = (v) => mg.t + alto * (1 - v / topo);
    const caminho = (pts) => pts.map((v, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    let svg = `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}">${defs}${eixoY(W, Hh, mg, topo, passo)}`;
    [1, 5, 10, 15, 20, 25, nDias].forEach((d) => { svg += `<text x="${X(d)}" y="${Hh - 6}" text-anchor="middle">${d}</text>`; });
    if (sb.pts.length) svg += `<path class="linha-b" d="${caminho(sb.pts)}"/>`;
    if (sa.pts.length) {
      svg += `<path class="area-a" d="${caminho(sa.pts)}L${X(sa.pts.length)},${Y(0)}L${X(1)},${Y(0)}Z"/>`;
      svg += `<path class="linha-a" d="${caminho(sa.pts)}"/>`;
    }
    svg += '<g data-cursor></g>';
    caixaGraf.innerHTML = svg + '</svg>';
    const nome = (ym) => `${nomeMes(ym)[0].toUpperCase()}${nomeMes(ym).slice(1)}`;
    const dia = Math.min(sa.pts.length, sb.pts.length) || 1;
    const va = sa.pts[dia - 1] || 0;
    const vb = sb.pts[dia - 1] || 0;
    const p = vb ? ((va - vb) / vb) * 100 : 0;
    legenda.innerHTML = `Até o dia ${dia}: ${nome(A)} <b>${brl(va)}</b>, ${nome(B)} <b>${brl(vb)}</b>` + (vb ? ` (${p >= 0 ? '+' : ''}${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)` : '');
    caixaGraf.setAttribute('aria-label', `Faturamento acumulado dia a dia. ${legenda.textContent}`);

    const cursor = $('[data-cursor]', caixaGraf);
    const mostrarDica = (d) => {
      $('.dica', caixaGraf)?.remove();
      cursor.innerHTML = '';
      if (!d) return;
      const a = sa.pts[d - 1];
      const b = sb.pts[d - 1];
      let g = `<line class="guia" x1="${X(d)}" x2="${X(d)}" y1="${mg.t}" y2="${Y(0)}"/>`;
      if (b !== undefined) g += `<circle class="marca-b" cx="${X(d)}" cy="${Y(b)}" r="4"/>`;
      if (a !== undefined) g += `<circle class="marca-a" cx="${X(d)}" cy="${Y(a)}" r="5"/>`;
      cursor.innerHTML = g;
      const el = document.createElement('div');
      el.className = 'dica';
      el.innerHTML = `<strong>Até o dia ${d}</strong>` + (a !== undefined ? `<p><span><i class="ponto ponto--a"></i> ${nome(A)}</span><b>${brl(a)}</b></p>` : '')
        + (b !== undefined ? `<p><span><i class="ponto ponto--b"></i> ${nome(B)}</span><b>${brl(b)}</b></p>` : '');
      el.style.left = `${Math.min(Math.max(X(d), 90), W - 90)}px`;
      caixaGraf.append(el);
    };
    caixaGraf.onpointermove = (e) => {
      const r = caixaGraf.getBoundingClientRect();
      const d = Math.round(((e.clientX - r.left - mg.l) / (W - mg.l - mg.r)) * (nDias - 1)) + 1;
      mostrarDica(d >= 1 && d <= nDias ? d : 0);
    };
    caixaGraf.onpointerleave = () => mostrarDica(0);
  }

  function montarRanking() {
    const ym = mesDe(E.hoje);
    const lista = (E.resumo.servicos || []).filter((s) => s.mes === ym).sort((a, b) => b.qtd - a.qtd);
    const total = lista.reduce((t, s) => t + s.qtd, 0);
    const max = lista[0]?.qtd || 1;
    $('[data-ranking]').innerHTML = lista.length ? lista.slice(0, 6).map((s) => `
      <li><p class="barras__txt">${esc(s.servico)}<span>${s.qtd} (${Math.round((s.qtd / total) * 100)}%)</span></p>
        <div class="barras__trilho"><div class="barras__cheio" style="width:${(s.qtd / max) * 100}%"></div></div></li>`).join('')
      : '<li class="vazio">Nenhum atendimento lançado neste mês.</li>';
    const fotos = Object.fromEntries(E.equipe.map((p) => [p.nome, p.foto]));
    const pessoas = (E.resumo.barbeiros || []).filter((b) => b.mes === ym).sort((a, b) => b.total - a.total);
    $('[data-por-profissional]').innerHTML = pessoas.length ? pessoas.map((p) => `
      <li>${avatar(p.profissional, fotos[p.profissional])}<span class="pessoas__txt">${esc(p.profissional)}<small>${p.qtd} ${p.qtd === 1 ? 'atendimento' : 'atendimentos'}</small></span><b>${brl(p.total)}</b></li>`).join('')
      : '<li class="vazio">Sem atendimentos neste mês.</li>';
  }

  /* =====================================================================
     AGENDA
     ===================================================================== */
  function linhasAgenda(ags, bloqueios, vazio) {
    if (!ags.length && !bloqueios.length) return `<p class="vazio">${vazio}</p>`;
    const cab = `<div class="linhas__cab" aria-hidden="true"><span>Horário</span><span>Cliente</span><span>Serviço</span><span>Valor</span><span>Situação</span><span>${E.admin ? 'Mudar' : ''}</span></div>`;
    const opcoes = (atual) => Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === atual ? ' selected' : ''}>${v}</option>`).join('');
    const itens = ags.map((a) => `
      <div class="linha${a.status === 'cancelado' ? ' linha--apagada' : ''}">
        <p class="linha__hora">${a.inicio}<small>até ${a.fim}</small></p>
        <div class="linha__cliente"><strong>${esc(a.nome)}</strong>
          <a href="${telLink(a.telefone)}" target="_blank" rel="noopener">${icone('whatsapp')}${telTxt(a.telefone)}</a></div>
        <p class="linha__info">${esc(a.servicos.join(' + '))} com <b>${esc(a.profissional)}</b><span class="linha__valor-cel">, ${brl(a.total)}</span></p>
        <p class="linha__valor">${brl(a.total)}</p>
        <p class="linha__status"><span class="selo selo--${a.status}">${STATUS[a.status] || a.status}</span></p>
        ${E.admin ? `<div class="linha__acoes"><label class="campo"><span class="sr">Mudar situação de ${esc(a.nome)}</span><select data-status="${a.id}">${opcoes(a.status)}</select></label></div>` : '<div class="linha__acoes"></div>'}
      </div>`);
    const bloq = bloqueios.map((b) => {
      const ini = b.inicio.slice(11);
      const fim = b.fim.slice(11);
      const diaInteiro = ini === '00:00' && fim === '00:00';
      return `
      <div class="linha">
        <p class="linha__hora">${diaInteiro ? 'Dia' : ini}<small>${diaInteiro ? 'inteiro' : `até ${fim}`}</small></p>
        <div class="linha__cliente"><strong>${esc(b.motivo || 'Pausa')}</strong></div>
        <p class="linha__info">${b.profissional ? esc(b.profissional) : 'Toda a equipe'}</p>
        <p class="linha__valor"></p>
        <p class="linha__status"><span class="selo selo--bloqueio">Bloqueado</span></p>
        <div class="linha__acoes">${E.admin ? `<button type="button" class="botao botao--contorno botao--p" data-desbloquear="${b.id}">Liberar</button>` : ''}</div>
      </div>`;
    });
    return `<div class="linhas">${cab}${[...itens, ...bloq].join('')}</div>`;
  }

  const diaInput = $('[data-dia-input]');
  async function carregarAgenda() {
    if (!E.diaAgenda) E.diaAgenda = E.hoje;
    diaInput.value = E.diaAgenda;
    $('[data-agenda-resumo]').textContent = extenso(E.diaAgenda) + (E.diaAgenda === E.hoje ? ' (hoje)' : '');
    try {
      const r = await painel('agenda', `&data=${E.diaAgenda}`);
      if (r.data !== E.diaAgenda) return;
      const validos = r.agendamentos.filter((a) => a.status !== 'cancelado');
      const previsto = validos.reduce((t, a) => t + a.total, 0);
      $('[data-agenda-resumo]').textContent = `${extenso(E.diaAgenda)}${E.diaAgenda === E.hoje ? ' (hoje)' : ''}: ${validos.length} ${validos.length === 1 ? 'horário' : 'horários'}${validos.length ? `, ${brl(previsto)} previstos` : ''}`;
      $('[data-agenda-lista]').innerHTML = linhasAgenda(r.agendamentos, r.bloqueios, 'Nenhum horário marcado nesse dia.');
    } catch (e) { avisar(e.message, true); }
  }
  $$('[data-dia]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.dia);
    E.diaAgenda = n === 0 ? E.hoje : somar(E.diaAgenda || E.hoje, n);
    carregarAgenda();
  }));
  diaInput.addEventListener('change', () => { if (diaInput.value) { E.diaAgenda = diaInput.value; carregarAgenda(); } });

  // mudar situação e liberar bloqueio (vale na agenda e na visão geral)
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    sel.disabled = true;
    try {
      await acao({ acao: 'status', id: Number(sel.dataset.status), status: sel.value });
      avisar(sel.value === 'concluido' ? 'Concluído e somado ao faturamento.' : `Marcado como ${STATUS[sel.value].toLowerCase()}.`);
    } catch (err) { avisar(err.message, true); }
    sel.disabled = false;
    recarregarAtual();
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-desbloquear]');
    if (!b) return;
    await ocupado(b, async () => { await acao({ acao: 'desbloquear', id: Number(b.dataset.desbloquear) }); avisar('Horário liberado.'); });
    recarregarAtual();
  });
  function recarregarAtual() {
    const s = $$('[data-secao]').find((x) => !x.hidden)?.dataset.secao;
    if (s === 'inicio') carregarResumo();
    if (s === 'agenda') carregarAgenda();
    if (s === 'atendimentos') carregarAtendimentos();
  }

  /* =====================================================================
     ATENDIMENTOS
     ===================================================================== */
  function periodo() {
    const H = E.hoje;
    const ym = mesDe(H);
    if (E.periodo === '7') return [somar(H, -6), H];
    if (E.periodo === 'mes') return [`${ym}-01`, H];
    if (E.periodo === 'passado') {
      const p = mesAnterior(ym);
      const [a, m] = p.split('-').map(Number);
      return [`${p}-01`, `${p}-${diasNoMes(a, m - 1)}`];
    }
    return [H, H];
  }
  $$('[data-periodo]').forEach((b) => b.addEventListener('click', () => {
    E.periodo = b.dataset.periodo;
    $$('[data-periodo]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    carregarAtendimentos();
  }));

  async function carregarAtendimentos() {
    const [de, ate] = periodo();
    try {
      const { atendimentos: lista } = await painel('atendimentos', `&de=${de}&ate=${ate}`);
      const total = lista.reduce((t, a) => t + a.valor, 0);
      const cont = {};
      lista.forEach((a) => a.servicos.forEach((s) => { cont[s] = (cont[s] || 0) + 1; }));
      const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
      $('[data-at-totais]').innerHTML = `
        <div><dt>Faturado</dt><dd>${brl(total)}</dd></div>
        <div><dt>Atendimentos</dt><dd>${lista.length}</dd></div>
        <div><dt>Ticket médio</dt><dd>${brl(lista.length ? total / lista.length : 0)}</dd></div>
        <div><dt>Mais feito</dt><dd>${top ? esc(top[0]) : 'nenhum'}</dd></div>`;
      const curtoData = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
      $('[data-at-lista]').innerHTML = !lista.length ? '<p class="vazio">Nada lançado nesse período. Use "Lançar atendimento" para registrar os cortes do dia.</p>'
        : `<div class="linhas linhas--at"><div class="linhas__cab" aria-hidden="true"><span>Quando</span><span>Serviço</span><span>Quem atendeu</span><span>Valor</span><span></span></div>${lista.slice(0, 300).map((a) => `
          <div class="linha">
            <p class="linha__hora">${a.hora}<small>${curtoData(a.data)}</small></p>
            <div class="linha__cliente"><strong>${esc(a.servicos.join(' + '))}</strong>${a.cliente ? `<span class="linha__info">Agendado por ${esc(a.cliente)}</span>` : ''}</div>
            <p class="linha__info">${esc(a.profissional)}<span class="linha__valor-cel">, <b>${brl(a.valor)}</b></span></p>
            <p class="linha__valor">${brl(a.valor)}</p>
            <div class="linha__acoes"><button type="button" class="icone-bt" data-apagar="${a.id}" aria-label="Apagar atendimento de ${esc(a.servicos.join(' + '))}, ${a.hora}">${icone('lixo')}</button></div>
          </div>`).join('')}</div>${lista.length > 300 ? '<p class="bloco__dica">Mostrando os 300 mais recentes. Os totais acima contam todos.</p>' : ''}`;
    } catch (e) { avisar(e.message, true); }
  }
  // apagar pede um segundo toque (sem janela do navegador)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-apagar]');
    if (!b) return;
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar', 'botao', 'botao--perigo', 'botao--p');
      b.classList.remove('icone-bt');
      b.textContent = 'Apagar?';
      setTimeout(() => { if (b.isConnected && b.classList.contains('confirmar')) { b.className = 'icone-bt'; b.innerHTML = icone('lixo'); } }, 3500);
      return;
    }
    b.classList.remove('confirmar');
    await ocupado(b, async () => { await acao({ acao: 'apagarAtendimento', id: Number(b.dataset.apagar) }); avisar('Atendimento apagado.'); });
    carregarAtendimentos();
  });

  /* =====================================================================
     HORÁRIOS
     ===================================================================== */
  const formHoras = $('[data-form-horarios]');
  function montarHorarios() {
    const ordem = [0, 1, 2, 3, 4, 5, 6];
    $('[data-semana]').innerHTML = ordem.map((d) => {
      const h = E.horarios[d];
      const p = (E.pausas[d] || [])[0];
      return `
      <div class="dia-linha${h ? '' : ' dia-linha--fechado'}${p ? '' : ' dia-linha--sem-pausa'}" data-dia-semana="${d}">
        <div class="dia-linha__topo"><strong>${DIAS[d]}</strong>
          <label class="troca"><input type="checkbox" name="aberto-${d}"${h ? ' checked' : ''}><span class="troca__bola" aria-hidden="true"></span><span data-aberto-txt>${h ? 'Aberto' : 'Fechado'}</span></label></div>
        <div class="dia-linha__horas">
          <label class="campo"><span>Abre</span><input type="time" step="300" name="abre-${d}" value="${h?.[0] || '09:00'}"></label>
          <label class="campo"><span>Fecha</span><input type="time" step="300" name="fecha-${d}" value="${h?.[1] || '20:00'}"></label>
        </div>
        <div class="dia-linha__pausa">
          <label class="troca"><input type="checkbox" name="pausa-${d}"${p ? ' checked' : ''}><span class="troca__bola" aria-hidden="true"></span>Pausa</label>
          <label class="campo"><span>Das</span><input type="time" step="300" name="pini-${d}" value="${p?.[0] || '16:00'}"${p ? '' : ' disabled'}></label>
          <label class="campo"><span>Até</span><input type="time" step="300" name="pfim-${d}" value="${p?.[1] || '17:00'}"${p ? '' : ' disabled'}></label>
        </div>
      </div>`;
    }).join('');
  }
  formHoras.addEventListener('change', (e) => {
    const n = e.target.name || '';
    const linha = e.target.closest('[data-dia-semana]');
    if (n.startsWith('aberto-')) {
      linha.classList.toggle('dia-linha--fechado', !e.target.checked);
      $('[data-aberto-txt]', linha).textContent = e.target.checked ? 'Aberto' : 'Fechado';
    }
    if (n.startsWith('pausa-')) {
      linha.classList.toggle('dia-linha--sem-pausa', !e.target.checked);
      $$('input[type="time"]', $('.dia-linha__pausa', linha)).forEach((i) => { i.disabled = !e.target.checked; });
    }
  });
  formHoras.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formHoras.elements;
    const horarios = {};
    const pausas = {};
    for (let d = 0; d < 7; d++) {
      horarios[d] = f[`aberto-${d}`].checked ? [f[`abre-${d}`].value, f[`fecha-${d}`].value] : null;
      if (horarios[d] && f[`pausa-${d}`].checked) pausas[d] = [[f[`pini-${d}`].value, f[`pfim-${d}`].value]];
    }
    ocupado(e.submitter, async () => {
      await acao({ acao: 'horarios', horarios, pausas });
      E.horarios = horarios;
      E.pausas = pausas;
      avisar('Horários salvos. O site atualiza em até 1 minuto.');
    });
  });

  /* =====================================================================
     PREÇOS
     ===================================================================== */
  const formPrecos = $('[data-form-precos]');
  function montarPrecos() {
    $('[data-precos]').innerHTML = E.servicos.map((s, i) => `
      <div class="preco-linha">
        <strong>${esc(s.nome)}</strong>
        <label class="campo campo--real"><span>Preço</span><input type="number" inputmode="numeric" min="0" max="5000" step="1" name="preco-${i}" value="${s.preco}" required></label>
        <label class="campo"><span>Tempo (min)</span><input type="number" inputmode="numeric" min="5" max="480" step="5" name="min-${i}" value="${s.min}" required></label>
      </div>`).join('');
  }
  formPrecos.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formPrecos.elements;
    const servicos = {};
    E.servicos.forEach((s, i) => { servicos[s.nome] = { preco: Number(f[`preco-${i}`].value), min: Number(f[`min-${i}`].value) }; });
    ocupado(e.submitter, async () => {
      await acao({ acao: 'precos', servicos });
      E.servicos = E.servicos.map((s) => ({ ...s, ...servicos[s.nome] }));
      avisar('Preços salvos. O site atualiza em até 1 minuto.');
    });
  });

  /* =====================================================================
     EQUIPE
     ===================================================================== */
  function montarEquipe() {
    $('[data-equipe]').innerHTML = E.equipe.map((m) => {
      const eu = m.id === E.conta.id;
      return `
      <article class="membro${m.ativo ? '' : ' membro--inativo'}" data-membro="${m.id}">
        <div class="membro__topo">
          <div class="membro__foto">${avatar(m.nome, m.foto)}
            <button type="button" data-foto="${m.id}" aria-label="Trocar a foto de ${esc(m.nome)}">${icone('camera')}</button></div>
          <div class="membro__txt"><strong>${esc(m.nome)}${eu ? ' (você)' : ''}</strong><small>${esc(m.email)}</small></div>
        </div>
        <span class="membro__selos"><span class="selo membro__papel">${m.ativo ? PAPEL[m.papel] : 'Sem acesso'}</span><span class="selo ${m.doisFatores ? 'selo--concluido' : 'selo--cancelado'}">${m.doisFatores ? '2FA ativo' : 'Sem 2FA'}</span></span>
        <label class="troca"><input type="checkbox" data-atende="${m.id}"${m.atende ? ' checked' : ''}${m.ativo ? '' : ' disabled'}><span class="troca__bola" aria-hidden="true"></span>Aparece no agendamento do site</label>
        <label class="campo"><span>Atende no site</span><select data-area="${m.id}"${m.ativo ? '' : ' disabled'}>${Object.entries(AREAS).map(([k, v]) => `<option value="${k}"${(m.area || 'ambos') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <div class="membro__acoes">
          <button type="button" class="botao botao--contorno botao--p" data-renomear="${m.id}">Mudar nome</button>
          ${m.papel === 'barbeiro' ? `<button type="button" class="botao botao--contorno botao--p" data-nova-senha="${m.id}">Nova senha</button>` : ''}
          ${m.foto ? `<button type="button" class="botao botao--contorno botao--p" data-sem-foto="${m.id}">Tirar foto</button>` : ''}
          ${!eu && m.doisFatores ? `<button type="button" class="botao botao--contorno botao--p" data-zerar2fa="${m.id}">Zerar 2FA</button>` : ''}
          ${eu ? '' : `<button type="button" class="botao ${m.ativo ? 'botao--perigo' : 'botao--contorno'} botao--p" data-ativo="${m.id}" data-valor="${!m.ativo}">${m.ativo ? 'Tirar acesso' : 'Devolver acesso'}</button>`}
        </div>
        <form class="grade-campos" data-inline hidden></form>
      </article>`;
    }).join('');
  }
  async function editar(dados, msg) {
    const r = await acao({ acao: 'editarMembro', ...dados });
    E.equipe = r.equipe;
    montarEquipe();
    avisar(msg);
  }
  const equipeEl = $('[data-equipe]');
  equipeEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-area]');
    if (sel) {
      ocupado(null, () => editar({ id: Number(sel.dataset.area), area: sel.value }, `Agora atende: ${AREAS[sel.value].toLowerCase()}.`));
      return;
    }
    const c = e.target.closest('[data-atende]');
    if (!c) return;
    ocupado(null, () => editar({ id: Number(c.dataset.atende), atende: c.checked }, c.checked ? 'Agora aparece no agendamento.' : 'Saiu do agendamento do site.'));
  });
  equipeEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const card = b.closest('[data-membro]');
    const id = Number(card?.dataset.membro);
    const membro = E.equipe.find((m) => m.id === id);
    const inline = $('[data-inline]', card);
    const abrirInline = (html, enviar) => {
      inline.innerHTML = html;
      inline.hidden = false;
      inline.querySelector('input')?.focus();
      inline.onsubmit = (ev) => { ev.preventDefault(); ocupado(ev.submitter, () => enviar(new FormData(inline))); };
      $('[data-cancelar]', inline).onclick = () => { inline.hidden = true; inline.innerHTML = ''; };
    };
    if ('foto' in b.dataset) { escolherFoto(id); return; }
    if ('semFoto' in b.dataset) { ocupado(b, async () => { const r = await acao({ acao: 'foto', id, imagem: null }); E.equipe = r.equipe; montarEquipe(); avisar('Foto removida.'); }); return; }
    if ('zerar2fa' in b.dataset) {
      if (!b.classList.contains('confirmar')) { b.classList.add('confirmar'); b.textContent = 'Confirmar?'; return; }
      ocupado(b, async () => { const r = await acao({ acao: 'zerar2fa', id }); E.equipe = r.equipe; montarEquipe(); avisar(`${membro.nome.split(' ')[0]} vai ativar a verificação de novo no próximo acesso.`); });
      return;
    }
    if ('ativo' in b.dataset) {
      const ativo = b.dataset.valor === 'true';
      if (!ativo && !b.classList.contains('confirmar')) { b.classList.add('confirmar'); b.textContent = 'Confirmar?'; return; }
      ocupado(b, () => editar({ id, ativo }, ativo ? 'Acesso devolvido.' : `${membro.nome} não entra mais no painel.`));
      return;
    }
    if ('renomear' in b.dataset) {
      abrirInline(`<label class="campo"><span>Novo nome</span><input name="nome" value="${esc(membro.nome)}" maxlength="80" required></label>
        <div class="bloco__acoes"><button type="button" class="botao botao--contorno botao--p" data-cancelar>Cancelar</button><button class="botao botao--claro botao--p">Salvar nome</button></div>`,
      (fd) => editar({ id, nome: fd.get('nome') }, 'Nome atualizado. A agenda antiga acompanha.'));
    }
    if ('novaSenha' in b.dataset) {
      abrirInline(`<label class="campo"><span>Nova senha para ${esc(membro.nome.split(' ')[0])}</span><input name="senha" type="text" minlength="8" maxlength="200" autocomplete="new-password" required><small>Pelo menos 8 caracteres. Passe para a pessoa.</small></label>
        <div class="bloco__acoes"><button type="button" class="botao botao--contorno botao--p" data-cancelar>Cancelar</button><button class="botao botao--claro botao--p">Trocar senha</button></div>`,
      async (fd) => { await acao({ acao: 'senhaMembro', id, senha: fd.get('senha') }); inline.hidden = true; avisar('Senha trocada.'); });
    }
  });

  // foto: corta no meio em quadrado e reduz para 320 px antes de mandar
  const arquivo = $('[data-foto-arquivo]');
  let fotoPara = 0;
  function escolherFoto(id) { fotoPara = id; arquivo.value = ''; arquivo.click(); }
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { avisar('Escolha uma imagem.', true); return; }
    try {
      const img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.'));
        i.src = URL.createObjectURL(f);
      });
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 320;
      c.getContext('2d').drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 320, 320);
      URL.revokeObjectURL(img.src);
      let dados = c.toDataURL('image/webp', 0.85);
      if (!dados.startsWith('data:image/webp')) dados = c.toDataURL('image/jpeg', 0.85); // Safari antigo
      const r = await acao({ acao: 'foto', id: fotoPara, imagem: dados });
      if (r.equipe?.length) E.equipe = r.equipe;
      if (fotoPara === E.conta.id) { E.conta.foto = E.equipe.find((m) => m.id === fotoPara)?.foto || E.conta.foto; pintarEu(); }
      montarEquipe();
      avisar('Foto atualizada. Já aparece no agendamento.');
    } catch (e) { avisar(e.message, true); }
  });

  const formMembro = $('[data-form-membro]');
  formMembro.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formMembro.elements;
    ocupado(e.submitter, async () => {
      const r = await acao({ acao: 'criarMembro', nome: f.nome.value, email: f.email.value, senha: f.senha.value, atende: f.atende.checked, area: f.area.value });
      E.equipe = r.equipe;
      montarEquipe();
      avisar(`Acesso criado. Passe o e-mail e a senha para ${f.nome.value.split(' ')[0]}.`);
      formMembro.reset();
    });
  });

  /* =====================================================================
     JANELAS: lançar atendimento e pausa/folga
     ===================================================================== */
  function abrirJanela(d) {
    d.showModal();
    document.documentElement.classList.add('travado');
    d.querySelector('select, input:not([type="hidden"])')?.focus();
  }
  $$('dialog.modal').forEach((d) => {
    d.addEventListener('close', () => { if (!$('dialog[open]')) document.documentElement.classList.remove('travado'); });
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    $$('[data-modal-fechar]', d).forEach((b) => b.addEventListener('click', () => d.close()));
  });

  const dLancar = $('[data-lancar]');
  const fLancar = $('[data-form-lancar]');
  const totalLancar = () => {
    const q = Number(fLancar.elements.quantidade.value) || 0;
    const v = Number(fLancar.elements.valor.value) || 0;
    $('[data-lancar-total]').innerHTML = `Total: <b>${brl(q * v)}</b>${q > 1 ? ` (${q} × ${brl(v)})` : ''}`;
  };
  $('[data-lancar-abrir]').addEventListener('click', () => {
    const f = fLancar.elements;
    f.servico.innerHTML = E.servicos.map((s) => `<option value="${esc(s.nome)}">${esc(s.nome)}, ${brl(s.preco)}</option>`).join('');
    f.profissional.innerHTML = E.profissionais.map((p) => `<option${p === E.conta.nome ? ' selected' : ''}>${esc(p)}</option>`).join('');
    f.quantidade.value = 1;
    f.data.value = E.hoje;
    f.data.max = E.hoje;
    f.data.min = somar(E.hoje, -90);
    f.valor.value = E.servicos[0]?.preco ?? 0;
    $('[data-lancar-erro]').hidden = true;
    totalLancar();
    abrirJanela(dLancar);
  });
  fLancar.addEventListener('change', (e) => {
    if (e.target.name === 'servico') fLancar.elements.valor.value = E.servicos.find((s) => s.nome === e.target.value)?.preco ?? 0;
    totalLancar();
  });
  fLancar.addEventListener('input', totalLancar);
  $$('[data-qtd]').forEach((b) => b.addEventListener('click', () => {
    const q = fLancar.elements.quantidade;
    q.value = Math.min(30, Math.max(1, (Number(q.value) || 1) + Number(b.dataset.qtd)));
    totalLancar();
  }));
  fLancar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = fLancar.elements;
    const erro = $('[data-lancar-erro]');
    erro.hidden = true;
    const bt = $('[data-lancar-salvar]');
    bt.disabled = true;
    try {
      const qtd = Number(f.quantidade.value);
      await acao({ acao: 'lancar', servico: f.servico.value, quantidade: qtd, profissional: f.profissional.value, data: f.data.value, valor: Number(f.valor.value) });
      dLancar.close();
      avisar(qtd > 1 ? `${qtd} atendimentos lançados.` : 'Atendimento lançado.');
      recarregarAtual();
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
    }
    bt.disabled = false;
  });

  const dBloq = $('[data-bloquear]');
  const fBloq = $('[data-form-bloquear]');
  $('[data-bloquear-abrir]').addEventListener('click', () => {
    const f = fBloq.elements;
    f.data.value = E.diaAgenda || E.hoje;
    f.data.min = E.hoje;
    f.profissional.innerHTML = '<option value="">Toda a equipe</option>' + E.profissionais.map((p) => `<option>${esc(p)}</option>`).join('');
    $('[data-bloquear-erro]').hidden = true;
    abrirJanela(dBloq);
  });
  fBloq.elements.diaInteiro.addEventListener('change', (e) => { $('[data-bloq-horas]').hidden = e.target.checked; });
  fBloq.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = fBloq.elements;
    const erro = $('[data-bloquear-erro]');
    erro.hidden = true;
    try {
      const dia = f.diaInteiro.checked;
      await acao({ acao: 'bloquear', data: f.data.value, inicio: dia ? '' : f.inicio.value, fim: dia ? '' : f.fim.value, profissional: f.profissional.value || null, motivo: f.motivo.value });
      dBloq.close();
      avisar('Bloqueado. No site esses horários aparecem riscados.');
      E.diaAgenda = f.data.value;
      recarregarAtual();
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
    }
  });

  /* ---------- quem está logado ---------- */
  function pintarEu() {
    $('[data-eu-avatar]').outerHTML = avatar(E.conta.nome, E.conta.foto).replace('class="avatar"', 'class="avatar" data-eu-avatar');
    $('[data-eu-nome]').textContent = E.conta.nome;
    $('[data-eu-papel]').textContent = PAPEL[E.conta.papel] || '';
  }
  $('[data-sair]').addEventListener('click', async () => {
    try { await api('conta', { acao: 'sair' }); } catch { /* sai de qualquer jeito */ }
    location.replace('entrar.html');
  });

  /* ---------- começo ---------- */
  (async function iniciar() {
    let r;
    try {
      r = await painel('inicio');
    } catch (e) {
      // cliente, ou alguém da equipe que ainda está com a senha provisória: volta para entrar.html
      if (/só da equipe|Crie sua senha|duas etapas/i.test(e.message)) { location.replace('entrar.html'); return; }
      $('[data-carregando]').innerHTML = `<p class="aviso aviso--erro">${esc(e.message)} <a href="painel.html">Tentar de novo</a></p>`;
      return;
    }
    Object.assign(E, { conta: r.conta, admin: r.conta.papel === 'admin', hoje: r.hoje, servicos: r.servicos, horarios: r.horarios, pausas: r.pausas, profissionais: r.profissionais, equipe: r.equipe });
    E.diaAgenda = E.hoje;
    if (!E.admin) $$('[data-so-admin]').forEach((el) => { el.hidden = true; });
    pintarEu();
    document.body.classList.remove('carregando');
    $('[data-carregando]').hidden = true;
    await mostrar(location.hash.slice(1));
  })();
})();

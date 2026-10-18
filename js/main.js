/* =====================================================================
   IMPÉRIO DANTAS · interações
   Para editar dados: CONFIG e HORARIOS logo abaixo.
   Os preços ficam no index.html (tabela de preços e JSON-LD).
   ===================================================================== */

const CONFIG = {
  whatsapp: '5511945046553',
  // endereço usado no mapa e no "Abrir no Google Maps"
  endereco: 'Estrada do Pequiá, 1828 - Vila Silviania, Carapicuíba - SP, 06381-095',
  // quem atende (aparece no passo 2 do agendamento). Ao mudar, mudar também em api/_lib.js
  profissionais: ['Gabriel Dantas'],
  // endereço da API de agendamento. Sem API no ar, o pedido segue pronto para o WhatsApp
  api: '/api',
};

// Horário de funcionamento (0 = domingo ... 6 = sábado). null = fechado.
const HORARIOS = {
  0: ['09:00', '15:00'],
  1: null,
  2: ['09:00', '20:00'],
  3: ['09:00', '20:00'],
  4: ['09:00', '20:00'],
  5: ['09:00', '20:00'],
  6: ['09:00', '20:00'],
};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR');
const escapar = (txt) => String(txt).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const duracao = (t) => (t >= 60 ? `${Math.floor(t / 60)}h${t % 60 ? String(t % 60).padStart(2, '0') : ''}` : `${t} min`);
const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hora = (hhmm) => hhmm.replace(':00', 'h').replace(':', 'h');
const preenchido = (txt) => txt && !txt.includes('[');
// telefone com máscara: (11) 91234-5678
const mascaraTel = (valor) => {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  return d.length > 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
};

/* ---------- Movimento: regras comuns a todo o site ----------
   Só transform e opacity. Entrada desacelerando (power4.out, perto de cubic-bezier(.22,1,.36,1)),
   300 a 450 ms; saída acelerando (power2.in) e mais curta. Cascata de 50 ms, no máximo 6 itens.
   O CSS deixa tudo visível: quem esconde é o GSAP na hora de animar. Sem GSAP ou com
   "reduzir movimento", as coisas só aparecem. */
const REDUZIR = matchMedia('(prefers-reduced-motion: reduce)').matches;
const comMovimento = () => Boolean(window.gsap) && !REDUZIR;
const ENTRA = 'power4.out';
const SAI = 'power2.in';
const cascata = (passo = 0.05) => (i) => Math.min(i, 5) * passo;

// trava a rolagem da página (menu ou tela por cima). Conta quantas estão abertas
let travas = 0;
function travarRolagem(sim) {
  travas = Math.max(0, travas + (sim ? 1 : -1));
  document.documentElement.classList.toggle('travado', travas > 0);
}

// revela no scroll uma vez só, quando o bloco entra ~12% na tela
function revelar(gatilho, itens) {
  const lista = [...itens].filter(Boolean);
  if (!comMovimento() || !window.ScrollTrigger || !gatilho || !lista.length) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.from(lista, {
    y: 16, opacity: 0, duration: 0.45, ease: ENTRA, stagger: cascata(), clearProps: 'transform,opacity',
    scrollTrigger: { trigger: gatilho, start: 'top 88%', once: true },
  });
}

/* ---------- Telas por cima (agendamento, fila e foto ampliada) ----------
   Celular: sobem de baixo como uma folha e fecham arrastando a alça para baixo.
   Desktop: aparecem no centro. O fundo escurecido entra e sai em fade (CSS). */
const ehFolha = (d) => d.classList.contains('agenda') && matchMedia('(max-width: 640px)').matches;
function abrirModal(d) {
  if (d.open) return;
  d.classList.remove('fechando');
  if (window.gsap) gsap.killTweensOf(d);
  d.showModal();
  travarRolagem(true);
  document.documentElement.classList.add('modal-aberto'); // a barra fixa do celular desce
  if (!comMovimento()) return;
  // atenção: nunca limpar o transform de um <dialog> aberto (clearProps). O GSAP mediria de novo e,
  // como o dialog não tem offsetParent, tiraria e recolocaria o elemento no DOM: ele sai da camada modal
  if (ehFolha(d)) gsap.fromTo(d, { y: 0, yPercent: 100 }, { yPercent: 0, duration: 0.35, ease: ENTRA });
  else gsap.fromTo(d, { opacity: 0, y: 16, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: ENTRA, clearProps: 'opacity' });
}
function fecharModal(d) {
  if (!d.open || d.classList.contains('fechando')) return;
  if (!comMovimento()) { d.close(); return; }
  d.classList.add('fechando');
  gsap.killTweensOf(d);
  const fim = () => { d.close(); d.classList.remove('fechando'); gsap.set(d, { y: 0, yPercent: 0, scale: 1, clearProps: 'opacity,height' }); };
  if (ehFolha(d)) gsap.to(d, { yPercent: 100, duration: 0.25, ease: SAI, onComplete: fim });
  else gsap.to(d, { opacity: 0, y: 8, duration: 0.2, ease: SAI, onComplete: fim });
}
// troca o conteúdo de uma tela: o atual sai para um lado, o novo entra do outro e a altura acompanha
function trocarConteudo(d, velha, mostrarNova, entrarNova, dir = 1) {
  if (!comMovimento() || !d.open || !velha || velha.hidden) { mostrarNova(); entrarNova?.(); return; }
  gsap.killTweensOf(velha);
  const h0 = d.offsetHeight;
  gsap.to(velha, {
    x: -16 * dir, opacity: 0, duration: 0.15, ease: SAI,
    onComplete: () => {
      gsap.set(velha, { clearProps: 'transform,opacity' });
      mostrarNova();
      const h1 = d.offsetHeight;
      // único lugar que anima altura: fica preso dentro da tela por cima, não mexe na página
      if (Math.abs(h1 - h0) > 2) gsap.fromTo(d, { height: h0 }, { height: h1, duration: 0.3, ease: ENTRA, clearProps: 'height' });
      entrarNova?.();
    },
  });
}
const entrarDe = (el, dir = 1) => {
  if (comMovimento()) gsap.fromTo(el, { x: 16 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: ENTRA, clearProps: 'transform,opacity' });
};
// celular: arrastar a alça (topo da folha) para baixo fecha
function arrastarParaFechar(d) {
  const alca = d.querySelector('.agenda__topo');
  if (!alca) return;
  let inicio = null;
  let dy = 0;
  let t0 = 0;
  alca.addEventListener('pointerdown', (e) => {
    if (!ehFolha(d) || !comMovimento() || e.target.closest('button')) return;
    inicio = e.clientY;
    dy = 0;
    t0 = performance.now();
    try { alca.setPointerCapture(e.pointerId); } catch { /* sem captura: o arraste segue enquanto o dedo estiver na alça */ }
  });
  alca.addEventListener('pointermove', (e) => {
    if (inicio === null) return;
    dy = Math.max(0, e.clientY - inicio);
    gsap.set(d, { y: dy });
  });
  const soltar = () => {
    if (inicio === null) return;
    inicio = null;
    const rapido = dy / Math.max(1, performance.now() - t0) > 0.6; // px por ms
    if (dy > 110 || (rapido && dy > 30)) fecharModal(d);
    else gsap.to(d, { y: 0, duration: 0.25, ease: ENTRA });
  };
  alca.addEventListener('pointerup', soltar);
  alca.addEventListener('pointercancel', soltar);
}
document.querySelectorAll('dialog').forEach((d) => {
  // prepara o transform no GSAP enquanto o dialog está fechado (ver o aviso em abrirModal)
  if (window.gsap) gsap.set(d, { x: 0, y: 0, yPercent: 0, scale: 1 });
  d.addEventListener('cancel', (e) => { e.preventDefault(); fecharModal(d); }); // Esc fecha com a mesma animação
  d.addEventListener('click', (e) => { if (e.target === d) fecharModal(d); }); // toque no fundo escurecido
  d.addEventListener('close', () => {
    travarRolagem(false);
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('modal-aberto');
  });
  arrastarParaFechar(d);
});

// serviços: a tabela de preços do index.html é a fonte única
const SERVICOS = [...document.querySelectorAll('.quadro [data-servico]')].map((a) => ({
  nome: a.dataset.servico, preco: Number(a.dataset.preco), min: Number(a.dataset.min),
}));

/* ---------- WhatsApp: um lugar só para montar os links ---------- */
function linkWhatsApp(mensagem) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

document.querySelectorAll('[data-wa]').forEach((a) => { a.href = linkWhatsApp(a.dataset.wa); });
// Tabela: cada serviço abre o agendamento com ele marcado no passo 1
document.querySelectorAll('[data-servico]').forEach((b) => {
  const { servico, preco, min } = b.dataset;
  b.setAttribute('aria-label', `Agendar ${servico}, ${brl(Number(preco))}, ${min} minutos`);
});

/* ---------- Tempos: a tabela de preços (data-min) é a fonte única ---------- */
document.querySelectorAll('.quadro [data-servico] .quadro__tempo').forEach((el) => {
  el.textContent = `${el.closest('[data-servico]').dataset.min} min`;
});
(function faqJsonLd() {
  const script = [...document.querySelectorAll('script[type="application/ld+json"]')].find((s) => s.textContent.includes('"FAQPage"'));
  const itens = document.querySelectorAll('.duvidas details');
  if (!script || !itens.length) return;
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [...itens].map((d) => ({
      '@type': 'Question',
      name: d.querySelector('summary').textContent.trim(),
      acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() },
    })),
  });
})();
// "Quero esse" (trabalhos da casa): abre o agendamento com o serviço da foto já marcado
document.querySelectorAll('[data-quero]').forEach((b) => {
  b.setAttribute('aria-label', `Quero esse: ${b.dataset.quero}. Abrir o agendamento com o serviço marcado`);
});

/* ---------- Hora em São Paulo (independe do fuso de quem visita) ---------- */
function agoraSP() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v.weekday);
  return { dia, min: Number(v.hour) * 60 + Number(v.minute) };
}

/* ---------- Status ao vivo (topo) e "hoje" na tabela ---------- */
function abertoAgora() {
  const { dia, min } = agoraSP();
  const hoje = HORARIOS[dia];
  return Boolean(hoje && min >= minutos(hoje[0]) && min < minutos(hoje[1]));
}
// próximo horário de abertura: { quando: 'hoje' | 'amanhã' | 'terça'..., hora: '09h' }
function proximaAbertura() {
  const { dia, min } = agoraSP();
  for (let i = 0; i < 8; i++) {
    const d = (dia + i) % 7;
    const h = HORARIOS[d];
    if (!h || (i === 0 && min >= minutos(h[0]))) continue;
    return { quando: i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[d], hora: hora(h[0]) };
  }
  return null;
}
function atualizarStatus() {
  const alvo = document.querySelector('[data-status]');
  if (!alvo) return;
  const aberto = abertoAgora();
  document.body.classList.toggle('aberto', aberto);
  if (aberto) {
    alvo.textContent = `Aberto agora, fecha às ${hora(HORARIOS[agoraSP().dia][1])}`;
    return;
  }
  const prox = proximaAbertura();
  if (prox) alvo.textContent = `Fechado agora, abre ${prox.quando} às ${prox.hora}`;
}
atualizarStatus();
setInterval(atualizarStatus, 60 * 1000);
document.querySelector(`[data-dia-semana="${agoraSP().dia}"]`)?.classList.add('hoje');

/* ---------- Abertura (1ª visita da sessão) e entrada do topo ----------
   A abertura é CSS (~1,2s) e sai sozinha; toque ou tecla pula. O topo entra emendado na saída:
   status, título, texto e botões em cascata curta; a foto com fade e leve escala (1.04 → 1). */
const comIntro = !document.documentElement.classList.contains('sem-intro');
const intro = document.querySelector('[data-intro]');
const entradaTopo = (function () {
  const itens = [...document.querySelectorAll('.hero__texto > *')];
  const foto = document.querySelector('.hero__foto img');
  // sem abertura e com a página já pintada, animar agora faria o topo piscar: fica como está
  const jaPintou = (performance.getEntriesByType?.('paint') || []).some((p) => p.name === 'first-contentful-paint');
  if (!comMovimento() || !itens.length || (!comIntro && jaPintou)) return null;
  return gsap.timeline({ paused: true, defaults: { ease: ENTRA } })
    .from(itens, { y: 16, opacity: 0, duration: 0.45, stagger: cascata(0.06), clearProps: 'transform,opacity' })
    .from(foto, { opacity: 0, scale: 1.04, duration: 0.55, clearProps: 'transform,opacity' }, 0.05);
})();
const iniciarTopo = () => entradaTopo?.play();
if (intro && comIntro) {
  const pular = () => { intro.classList.add('intro--sai'); iniciarTopo(); };
  intro.addEventListener('click', pular);
  addEventListener('keydown', pular, { once: true });
  // o CSS tira a abertura em 0,95s; o topo começa a entrar junto com a saída
  setTimeout(iniciarTopo, Math.max(0, 950 - performance.now()));
  intro.addEventListener('animationend', (e) => { if (e.animationName === 'intro-sai') intro.classList.add('intro--fim'); });
} else {
  intro?.remove();
  iniciarTopo();
}

/* ---------- Menu (celular) ---------- */
const botaoMenu = document.querySelector('[data-menu]');
const menu = document.getElementById('menu');
if (botaoMenu && menu) {
  // painel desliza com fade e os itens entram em cascata (CSS); a página fica parada atrás
  let aberto = false;
  const definir = (sim) => {
    if (sim === aberto) return;
    aberto = sim;
    menu.classList.toggle('aberto', sim);
    botaoMenu.setAttribute('aria-expanded', String(sim));
    botaoMenu.setAttribute('aria-label', sim ? 'Fechar menu' : 'Abrir menu');
    travarRolagem(sim);
  };
  const fechar = () => definir(false);
  botaoMenu.addEventListener('click', () => definir(!aberto));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', fechar));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches) fechar(); });
}

/* ---------- Tabela de preços: a placa aparece e o conteúdo entra em cascata curta (uma vez) ---------- */
(function animarTabela() {
  const placa = document.querySelector('.quadro__placa');
  if (!placa || !comMovimento() || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const itens = [...placa.querySelectorAll('.quadro__topo > *, .quadro__grupo'), placa.querySelector('.quadro__glossario')];
  gsap.timeline({ defaults: { ease: ENTRA }, scrollTrigger: { trigger: placa, start: 'top 88%', once: true } })
    .from(placa, { opacity: 0, duration: 0.3, clearProps: 'opacity' })
    .from(itens, { y: 16, opacity: 0, duration: 0.45, stagger: cascata(), clearProps: 'transform,opacity' }, 0.08);
})();

/* ---------- Foto do topo: efeito "tilted card" (adaptado do React Bits com GSAP) ----------
   A foto inclina seguindo o mouse, cresce um pouco e uma etiqueta acompanha o cursor.
   Só em telas com mouse e sem "reduzir movimento". */
(function tiltHero() {
  const fig = document.querySelector('[data-tilt]');
  if (!fig || !window.gsap) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const miolo = fig.querySelector('.tilt__miolo');
  const legenda = fig.querySelector('.tilt__legenda');
  const AMPLITUDE = 10;   // graus máximos de inclinação
  const ESCALA = 1.04;    // zoom ao passar o mouse
  const mola = { duration: 0.6, ease: 'power3.out' };
  const rotX = gsap.quickTo(miolo, 'rotationX', mola);
  const rotY = gsap.quickTo(miolo, 'rotationY', mola);
  const escala = gsap.quickTo(miolo, 'scale', mola);
  const legX = gsap.quickTo(legenda, 'x', { duration: 0.25, ease: 'power3.out' });
  const legY = gsap.quickTo(legenda, 'y', { duration: 0.25, ease: 'power3.out' });
  const legGiro = gsap.quickTo(legenda, 'rotation', { duration: 0.4, ease: 'power3.out' });
  const legOpac = gsap.quickTo(legenda, 'opacity', { duration: 0.3 });
  let ultimoY = 0;
  fig.addEventListener('mouseenter', () => { miolo.style.willChange = 'transform'; escala(ESCALA); legOpac(1); });
  fig.addEventListener('mousemove', (e) => {
    const r = fig.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2;
    const dy = e.clientY - r.top - r.height / 2;
    rotX((dy / (r.height / 2)) * -AMPLITUDE);
    rotY((dx / (r.width / 2)) * AMPLITUDE);
    legX(e.clientX - r.left);
    legY(e.clientY - r.top);
    legGiro(-(dy - ultimoY) * 0.6);
    ultimoY = dy;
  });
  fig.addEventListener('mouseleave', () => {
    rotX(0); rotY(0); escala(1); legOpac(0); legGiro(0);
    setTimeout(() => { miolo.style.willChange = ''; }, 700);
  });
})();

/* ---------- Trabalhos da casa: título, texto e fotos entram com fade e leve subida (uma vez) ---------- */
(function animarTrabalhos() {
  const sec = document.getElementById('trabalhos');
  if (!sec) return;
  revelar(sec.querySelector('.trabalhos__topo'), sec.querySelectorAll('.trabalhos__topo > *'));
  revelar(sec.querySelector('.galeria'), sec.querySelectorAll('.galeria > .foto'));
})();

/* ---------- Caixas que abrem (química e dúvidas) ----------
   O conteúdo aparece na hora (sem animar altura) e entra com fade e leve descida; fecha mais rápido. */
document.querySelectorAll('.quadro__glossario, .duvidas details').forEach((det) => {
  const resumo = det.querySelector('summary');
  const caixa = document.createElement('div');
  caixa.className = 'det__conteudo';
  [...det.children].filter((c) => c !== resumo).forEach((c) => caixa.append(c));
  det.append(caixa);
  if (!comMovimento()) return;
  resumo.addEventListener('click', (e) => {
    e.preventDefault();
    gsap.killTweensOf(caixa);
    if (!det.open) {
      det.open = true;
      gsap.fromTo(caixa, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.3, ease: ENTRA, clearProps: 'transform,opacity' });
      const itens = caixa.querySelectorAll('dl > div');
      if (itens.length) gsap.from(itens, { y: 8, opacity: 0, duration: 0.3, stagger: cascata(0.04), ease: ENTRA, clearProps: 'transform,opacity' });
    } else {
      gsap.to(caixa, {
        opacity: 0, y: -4, duration: 0.15, ease: SAI,
        onComplete: () => { det.open = false; gsap.set(caixa, { clearProps: 'transform,opacity' }); },
      });
    }
  });
});

/* ---------- Dúvidas: título e perguntas entram em cascata curta (uma vez) ---------- */
revelar(document.querySelector('.duvidas'), document.querySelectorAll('.duvidas > .titulo, .duvidas details'));

/* ---------- Foto ampliada ---------- */
const dialogo = document.querySelector('[data-ampliada]');
if (dialogo && typeof dialogo.showModal === 'function') {
  const img = document.createElement('img');
  img.width = 1200;
  img.height = 1600;
  img.decoding = 'async';
  dialogo.prepend(img);
  document.querySelectorAll('[data-ampliar]').forEach((b) => b.addEventListener('click', () => {
    img.src = b.dataset.ampliar;
    img.alt = b.querySelector('img').alt;
    abrirModal(dialogo);
  }));
  dialogo.querySelector('[data-fechar]').addEventListener('click', () => fecharModal(dialogo));
} else {
  // navegador sem <dialog>: abre a foto grande direto
  document.querySelectorAll('[data-ampliar]').forEach((b) => b.addEventListener('click', () => { location.href = b.dataset.ampliar; }));
}

/* ---------- Agendamento: tela em 4 passos (serviço, profissional, data e hora, confirmar) ----------
   Abre por cima da página em qualquer "Agendar" ([data-agenda], tabela e "Quero esse").
   Com a API no ar o horário é salvo no banco; sem ela, o pedido segue pronto para o WhatsApp. */
(function agenda() {
  const dialogo = document.querySelector('[data-agenda-dialogo]');
  // navegador sem <dialog>: os botões continuam indo direto para o WhatsApp
  if (!dialogo || typeof dialogo.showModal !== 'function') return;

  const form = dialogo.querySelector('form');
  const corpo = dialogo.querySelector('[data-agenda-corpo]');
  const etapas = [...dialogo.querySelectorAll('[data-etapa]')];
  const marcas = [...dialogo.querySelectorAll('[data-etapa-marca]')];
  const btVoltar = dialogo.querySelector('[data-agenda-voltar]');
  const btAvancar = dialogo.querySelector('[data-agenda-avancar]');
  const total = dialogo.querySelector('[data-agenda-total]');
  const caixaDias = dialogo.querySelector('[data-agenda-dias]');
  const mesNome = dialogo.querySelector('[data-mes-nome]');
  const btMes = [...dialogo.querySelectorAll('[data-mes]')];
  const caixaHoras = dialogo.querySelector('[data-agenda-horas]');
  const resumo = dialogo.querySelector('[data-agenda-resumo]');
  const erro = dialogo.querySelector('[data-agenda-erro]');
  const animar = window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEM_PREF = 'Sem preferência';
  const ocupadosPorDia = {}; // cache de /api/horarios
  let passo = 1;
  let enviando = false;
  let diaSel = '';    // dia escolhido (AAAA-MM-DD); fica guardado mesmo trocando de mês
  let mesVisto = 0;   // mês mostrado no calendário (ano * 12 + mês)

  // ----- passo 1: serviços (vêm da tabela de preços) -----
  dialogo.querySelector('[data-agenda-servicos]').innerHTML = SERVICOS.map((s, i) => `
    <label class="opcao"><input type="checkbox" name="servico" value="${i}">
      <span class="opcao__caixa"><strong>${s.nome}</strong><small>${s.min} min · ${brl(s.preco)}</small></span></label>`).join('');

  // ----- passo 2: profissionais -----
  const sigla = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');
  dialogo.querySelector('[data-agenda-profissionais]').innerHTML = [
    ...CONFIG.profissionais.map((n) => `
      <label class="opcao"><input type="radio" name="profissional" value="${n}">
        <span class="opcao__caixa opcao__caixa--pessoa"><span class="opcao__sigla" aria-hidden="true">${sigla(n)}</span><strong>${n}</strong></span></label>`),
    `<label class="opcao"><input type="radio" name="profissional" value="${SEM_PREF}">
        <span class="opcao__caixa opcao__caixa--pessoa"><span class="opcao__sigla" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-conta"/></svg></span><strong>${SEM_PREF}</strong><small>Quem estiver livre no horário</small></span></label>`,
  ].join('');

  const marcados = () => [...form.querySelectorAll('input[name="servico"]:checked')].map((c) => SERVICOS[Number(c.value)]);
  const duracaoTotal = () => marcados().reduce((t, s) => t + s.min, 0);
  const valor = (nome) => form.querySelector(`input[name="${nome}"]:checked`)?.value || '';

  // ----- passo 3: dias abertos e horários livres -----
  const hojeISO = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const dataDe = (iso) => new Date(iso + 'T12:00:00Z');
  const dataExtenso = (iso) => {
    const d = dataDe(iso);
    const dia = DIAS[d.getUTCDay()];
    return `${dia[0].toUpperCase()}${dia.slice(1)}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
  };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  // horários que cabem no expediente com a duração escolhida (de 30 em 30 min)
  function horariosDoDia(iso) {
    const h = HORARIOS[dataDe(iso).getUTCDay()];
    if (!h) return [];
    const dur = duracaoTotal() || 30;
    const [abre, fecha] = h.map(minutos);
    const limite = iso === hojeISO() ? agoraSP().min + 30 : 0;
    const lista = [];
    for (let t = abre; t + dur <= fecha; t += 30) if (t >= limite) lista.push(t);
    return lista;
  }

  // calendário do mês: só dias abertos, com horário livre e até DIAS_A_FRENTE dias (igual a api/_lib.js)
  const DIAS_A_FRENTE = 30;
  const isoDe = (d) => d.toISOString().slice(0, 10);
  const disponivel = (iso) => {
    const distancia = (dataDe(iso) - dataDe(hojeISO())) / 864e5;
    return distancia >= 0 && distancia <= DIAS_A_FRENTE && horariosDoDia(iso).length > 0;
  };

  function montarDias() {
    // sem dia escolhido (ou o escolhido deixou de servir): marca o primeiro dia livre
    if (!diaSel || !disponivel(diaSel)) {
      diaSel = '';
      const base = dataDe(hojeISO());
      for (let i = 0; i <= DIAS_A_FRENTE && !diaSel; i++) {
        const iso = isoDe(new Date(base.getTime() + i * 864e5));
        if (disponivel(iso)) diaSel = iso;
      }
    }
    const ref = dataDe(diaSel || hojeISO());
    mesVisto = ref.getUTCFullYear() * 12 + ref.getUTCMonth();
    montarCalendario();
    montarHoras();
  }

  function montarCalendario() {
    const ano = Math.floor(mesVisto / 12);
    const mes = mesVisto % 12;
    const hoje = hojeISO();
    const total = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    mesNome.textContent = `${MESES[mes][0].toUpperCase()}${MESES[mes].slice(1)} ${ano}`;
    let html = '<span aria-hidden="true"></span>'.repeat(new Date(Date.UTC(ano, mes, 1)).getUTCDay());
    for (let d = 1; d <= total; d++) {
      const iso = isoDe(new Date(Date.UTC(ano, mes, d)));
      const ehHoje = iso === hoje;
      html += `<label class="cal-dia${ehHoje ? ' cal-dia--hoje' : ''}"><input type="radio" name="dia" value="${iso}" aria-label="${dataExtenso(iso)}${ehHoje ? ', hoje' : ''}"${disponivel(iso) ? '' : ' disabled'}${iso === diaSel ? ' checked' : ''}><span>${d}</span></label>`;
    }
    caixaDias.innerHTML = html;
    // setas: não volta antes do mês atual nem passa do último mês com data liberada
    const h = dataDe(hoje);
    const limite = new Date(h.getTime() + DIAS_A_FRENTE * 864e5);
    btMes[0].disabled = mesVisto <= h.getUTCFullYear() * 12 + h.getUTCMonth();
    btMes[1].disabled = mesVisto >= limite.getUTCFullYear() * 12 + limite.getUTCMonth();
  }
  btMes.forEach((b) => b.addEventListener('click', () => {
    mesVisto += Number(b.dataset.mes);
    montarCalendario();
  }));

  // pergunta ao servidor o que já está ocupado no dia (se a API não responder, mostra tudo livre)
  async function buscarOcupados(iso) {
    if (!CONFIG.api || ocupadosPorDia[iso]) return;
    try {
      const r = await fetch(`${CONFIG.api}/horarios?data=${iso}`, { headers: { Accept: 'application/json' } });
      if (r.ok) ocupadosPorDia[iso] = (await r.json()).ocupados || [];
    } catch { /* sem API: segue sem bloquear horários */ }
  }

  function livre(iso, t) {
    const ocupados = ocupadosPorDia[iso];
    if (!ocupados?.length) return true;
    const fim = t + duracaoTotal();
    const quem = valor('profissional');
    const pessoas = quem && quem !== SEM_PREF ? [quem] : CONFIG.profissionais;
    // livre se pelo menos uma das pessoas possíveis não tem nada sobreposto
    return pessoas.some((p) => !ocupados.some((o) => o.profissional === p && t < minutos(o.fim) && fim > minutos(o.inicio)));
  }

  async function montarHoras(aviso = '') {
    const iso = diaSel;
    if (!iso) { caixaHoras.innerHTML = '<p class="etapa__dica">Nenhum dia com horário livre nas próximas semanas.</p>'; return; }
    const escolhida = valor('hora');
    await buscarOcupados(iso);
    if (diaSel !== iso) return; // a pessoa trocou de dia enquanto carregava
    const grupos = [['Manhã', 0, 720], ['Tarde', 720, 1080], ['Noite', 1080, 1440]];
    const lista = horariosDoDia(iso);
    if (!lista.length) { caixaHoras.innerHTML = '<p class="etapa__dica">Nenhum horário disponível nesse dia.</p>'; atualizar(); return; }
    caixaHoras.innerHTML = (aviso ? `<p class="agenda__erro" role="alert">${escapar(aviso)}</p>` : '') + grupos.map(([nome, ini, fim]) => {
      const itens = lista.filter((t) => t >= ini && t < fim);
      if (!itens.length) return '';
      return `<fieldset class="horas__grupo"><legend>${nome}</legend><div class="horas__lista">${itens.map((t) =>
        livre(iso, t)
          ? `<label class="hora"><input type="radio" name="hora" value="${hhmm(t)}"><span>${hhmm(t)}</span></label>`
          : `<label class="hora" title="Horário ocupado"><input type="radio" name="hora" value="${hhmm(t)}" disabled aria-label="${hhmm(t)}, ocupado"><span>${hhmm(t)}</span></label>`
      ).join('')}</div></fieldset>`;
    }).join('');
    const alvo = caixaHoras.querySelector(`input[value="${escolhida}"]:not(:disabled)`);
    if (alvo) alvo.checked = true;
    atualizar();
  }

  // ----- passo 4: resumo -----
  function montarResumo() {
    const lista = marcados();
    const linhas = [
      ['Serviço', lista.map((s) => s.nome).join(' + ')],
      ['Profissional', valor('profissional')],
      ['Data', dataExtenso(diaSel)],
      ['Horário', valor('hora')],
      ['Duração', duracao(duracaoTotal())],
    ];
    resumo.innerHTML = linhas.map(([k, v]) => `<div data-revela><dt>${k}</dt><dd>${v}</dd></div>`).join('')
      + `<div class="resumo__total" data-revela><dt>Total</dt><dd>${brl(lista.reduce((t, s) => t + s.preco, 0))}</dd></div>`;
  }

  const tel = form.elements.telefone;
  tel.addEventListener('input', () => { tel.value = mascaraTel(tel.value); });

  function valido(p) {
    if (p === 1) return marcados().length > 0;
    if (p === 2) return Boolean(valor('profissional'));
    if (p === 3) return Boolean(diaSel && valor('hora'));
    if (p === 4) return form.elements.nome.value.trim().length >= 2 && tel.value.replace(/\D/g, '').length >= 10;
    return true;
  }

  // total e tempo somam com uma contagem curta (0,3s) em vez de trocar de uma vez
  const conta = { preco: 0, min: 0 };
  const pintarConta = () => {
    total.querySelector('strong').textContent = brl(Math.round(conta.preco));
    total.querySelector('[data-t-min]').textContent = duracao(Math.round(conta.min));
  };
  function atualizar() {
    const lista = marcados();
    const preco = lista.reduce((t, s) => t + s.preco, 0);
    const min = duracaoTotal();
    if (!lista.length) {
      if (window.gsap) gsap.killTweensOf(conta);
      conta.preco = 0;
      conta.min = 0;
      total.innerHTML = '<span>Nenhum serviço escolhido</span>';
    } else {
      if (!total.querySelector('strong')) total.innerHTML = '<strong></strong><span><span data-t-min></span><span data-t-qtd></span></span>';
      total.querySelector('[data-t-qtd]').textContent = lista.length > 1 ? ` · ${lista.length} serviços` : '';
      if (animar && dialogo.open && (conta.preco !== preco || conta.min !== min)) {
        gsap.to(conta, { preco, min, duration: 0.3, ease: 'power2.out', overwrite: true, onUpdate: pintarConta });
      } else {
        conta.preco = preco;
        conta.min = min;
      }
      pintarConta();
    }
    btAvancar.disabled = enviando || !valido(passo);
  }

  // troca de passo: o atual sai para a esquerda e o próximo entra da direita (o inverso no Voltar)
  function irPara(n, semTransicao = false) {
    const dir = n >= passo ? 1 : -1;
    const velha = etapas.find((e) => !e.hidden);
    const nova = etapas.find((e) => Number(e.dataset.etapa) === n);
    passo = n;
    marcas.forEach((m) => {
      const i = Number(m.dataset.etapaMarca);
      m.classList.toggle('feita', i < n);
      m.classList.toggle('atual', i === n);
      if (i === n) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    dialogo.classList.toggle('agenda--fim', n === 5);
    btVoltar.hidden = n === 1 || n === 5;
    btAvancar.textContent = n === 4 ? 'Confirmar agendamento' : n === 5 ? 'Fechar' : 'Continuar';
    erro.hidden = true;
    if (n === 3) montarDias();
    if (n === 4) montarResumo();
    const mostrar = () => {
      etapas.forEach((e) => { e.hidden = e !== nova; });
      corpo.scrollTop = 0;
      nova.querySelector('.etapa__titulo')?.focus({ preventScroll: true });
    };
    if (semTransicao) mostrar(); // ao abrir, quem anima é a tela inteira
    else trocarConteudo(dialogo, velha, mostrar, () => entrar(nova, n, dir), dir);
    atualizar();
  }

  // entrada de cada passo. "Confirmar": as linhas do resumo em cascata curta.
  // Fim: o check se desenha e só depois entram título, texto e botão.
  function entrar(secao, n, dir) {
    if (!animar) return;
    if (n === 4) {
      entrarDe(secao, dir);
      gsap.from(secao.querySelectorAll('[data-revela]'), { y: 12, opacity: 0, duration: 0.35, ease: ENTRA, stagger: cascata(), delay: 0.05, clearProps: 'transform,opacity' });
    } else if (n === 5) {
      const check = secao.querySelector('.feito__check');
      gsap.timeline({ defaults: { ease: ENTRA } })
        .fromTo(check.querySelector('circle'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' })
        .fromTo(check.querySelector('path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.25, ease: 'power2.out' }, '-=0.05')
        .from([...secao.children].filter((c) => c !== check), { y: 12, opacity: 0, duration: 0.35, stagger: cascata(), clearProps: 'transform,opacity' }, '-=0.05');
    } else {
      entrarDe(secao, dir);
    }
  }

  // mensagem pronta para o WhatsApp do salão
  const mensagem = (d, salvo) => [
    salvo ? 'Olá! Acabei de marcar pelo site:' : 'Olá! Quero agendar pelo site:',
    `Serviço: ${d.servicos.join(' + ')}`,
    `Profissional: ${d.profissional}`,
    `Data: ${dataExtenso(d.data)}`,
    `Horário: ${d.hora}`,
    `Total: ${brl(d.total)} (${duracao(d.min)})`,
    `Nome: ${d.nome}`,
    `WhatsApp: ${d.telefoneTxt}`,
  ].join('\n');

  async function confirmar() {
    const lista = marcados();
    const dados = {
      servicos: lista.map((s) => s.nome),
      profissional: valor('profissional'),
      data: diaSel,
      hora: valor('hora'),
      nome: form.elements.nome.value.trim(),
      telefone: tel.value.replace(/\D/g, ''),
      telefoneTxt: tel.value,
      total: lista.reduce((t, s) => t + s.preco, 0),
      min: duracaoTotal(),
    };

    let salvo = false;
    if (CONFIG.api) {
      enviando = true;
      btAvancar.textContent = 'Salvando...';
      atualizar();
      try {
        const r = await fetch(`${CONFIG.api}/agendamentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            servicos: dados.servicos, profissional: dados.profissional, data: dados.data, hora: dados.hora,
            nome: dados.nome, telefone: dados.telefone, site: form.elements.site.value,
          }),
        });
        const resposta = await r.json().catch(() => ({}));
        if (r.ok) {
          salvo = true;
          if (resposta.profissional) dados.profissional = resposta.profissional;
        } else if ([400, 409, 429].includes(r.status)) {
          // erro que a pessoa consegue resolver: mostra e deixa corrigir
          enviando = false;
          const txt = resposta.erro || 'Não foi possível confirmar. Tente de novo.';
          if (r.status === 409) {
            delete ocupadosPorDia[dados.data]; // busca de novo o que está ocupado
            irPara(3);
            montarHoras(txt);
          } else {
            btAvancar.textContent = 'Confirmar agendamento';
            erro.textContent = txt;
            erro.hidden = false;
            atualizar();
          }
          return;
        }
        // 404, 500 ou sem rede: o pedido segue pelo WhatsApp
      } catch { /* sem conexão com a API: segue pelo WhatsApp */ }
      enviando = false;
    }

    const titulo = dialogo.querySelector('[data-feito-titulo]');
    const texto = dialogo.querySelector('[data-feito-texto]');
    const wa = dialogo.querySelector('[data-feito-wa]');
    const waTexto = dialogo.querySelector('[data-feito-wa-texto]');
    const primeiroNome = dados.nome.split(' ')[0];
    wa.href = linkWhatsApp(mensagem(dados, salvo));
    wa.classList.toggle('botao--claro', !salvo);
    wa.classList.toggle('botao--contorno', salvo);
    if (salvo) {
      titulo.textContent = `Horário marcado, ${primeiroNome}.`;
      texto.textContent = `${dataExtenso(dados.data)}, às ${dados.hora}, com ${dados.profissional}. Se precisar mudar, é só chamar no WhatsApp.`;
      waTexto.textContent = 'Avisar no WhatsApp';
    } else {
      titulo.textContent = `Falta só enviar, ${primeiroNome}.`;
      texto.textContent = `${dataExtenso(dados.data)}, às ${dados.hora}. Toque no botão para mandar o pedido pronto no WhatsApp; o salão responde confirmando.`;
      waTexto.textContent = 'Enviar no WhatsApp';
    }
    if (typeof window.gtag === 'function') window.gtag('event', 'agendamento', { salvo });
    irPara(5);
  }

  // ----- abrir, navegar e fechar -----
  function abrir(nomes, pular) {
    form.reset();
    diaSel = '';
    enviando = false;
    form.querySelectorAll('input[name="servico"]').forEach((c) => {
      c.checked = nomes.includes(SERVICOS[Number(c.value)].nome);
    });
    // só um profissional: já vem marcado
    if (CONFIG.profissionais.length === 1) form.querySelector('input[name="profissional"]').checked = true;
    passo = 0;
    abrirModal(dialogo);
    irPara(pular && marcados().length ? 2 : 1, true);
  }
  const fechar = () => fecharModal(dialogo);

  form.addEventListener('change', (e) => {
    if (e.target.name === 'dia') { diaSel = e.target.value; montarHoras(); }
    atualizar();
  });
  form.addEventListener('input', atualizar);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passo === 5) return fechar();
    if (enviando || !valido(passo)) return;
    if (passo === 4) confirmar(); else irPara(passo + 1);
  });
  btVoltar.addEventListener('click', () => irPara(Math.max(1, passo - 1)));
  dialogo.querySelector('[data-agenda-fechar]').addEventListener('click', fechar);

  // qualquer botão de agendar do site abre esta tela (com o serviço já marcado quando houver)
  document.addEventListener('click', (e) => {
    const gatilho = e.target.closest('[data-agenda], [data-agendar], [data-servico], [data-quero]');
    if (!gatilho || dialogo.contains(gatilho)) return;
    e.preventDefault();
    const lista = gatilho.dataset.servicos || gatilho.dataset.agendar || gatilho.dataset.servico || gatilho.dataset.agenda || '';
    abrir(lista.split('|').filter(Boolean), 'agendaPular' in gatilho.dataset);
  });
})();

/* ---------- Fila: atendimento por ordem de chegada ----------
   Só a interface: os dados vêm de js/api.js (hoje simulados). Neste aparelho fica guardado
   apenas o ID do ticket, para a pessoa ver a posição se fechar e abrir o site de novo. */
(function fila() {
  const botao = document.querySelector('[data-fila-abrir]');
  const info = document.querySelector('[data-fila-info]');
  const dialogo = document.querySelector('[data-fila-dialogo]');
  if (!botao || !info || !dialogo || !window.api) return;
  // navegador sem <dialog>: sem fila pelo site (o agendamento continua)
  if (typeof dialogo.showModal !== 'function') { botao.hidden = true; return; }

  const form = dialogo.querySelector('form');
  const telas = [...dialogo.querySelectorAll('[data-fila-tela]')];
  const acoes = [...dialogo.querySelectorAll('[data-fila-acoes]')];
  const erro = dialogo.querySelector('[data-fila-erro]');
  const agora = dialogo.querySelector('[data-fila-agora]');
  const btEntrar = dialogo.querySelector('[data-fila-entrar]');
  const tel = form.elements.whatsapp;
  const CHAVE = 'id-fila-ticket';
  const MIN_PADRAO = 30;            // serviço não informado
  const ATUALIZA = 15 * 1000;       // depois vira tempo real com o servidor

  const lerTicket = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
  const gravarTicket = (id) => {
    try { if (id) localStorage.setItem(CHAVE, id); else localStorage.removeItem(CHAVE); } catch { /* sem localStorage: vale só nesta aba */ }
  };
  let ticketId = lerTicket();
  let lista = [];
  let meu = null;
  let tela = 'entrar';
  let avisouProximo = false;

  const tempoDe = (servico) => SERVICOS.find((s) => s.nome === servico)?.min || MIN_PADRAO;
  const esperaDe = (pessoas) => pessoas.reduce((t, p) => t + tempoDe(p.servico), 0);
  const resumo = () => {
    const n = lista.length;
    const quantos = n === 0 ? 'Ninguém na fila agora' : n === 1 ? '1 pessoa na fila agora' : `${n} pessoas na fila agora`;
    return `<strong>${quantos}</strong> · ${n ? `espera estimada: ~${duracao(esperaDe(lista))}` : 'sem espera'}`;
  };
  const avisar = (txt) => { erro.textContent = txt; erro.hidden = false; };

  form.elements.servico.insertAdjacentHTML('beforeend',
    SERVICOS.map((s) => `<option value="${s.nome}">${s.nome} (${s.min} min)</option>`).join(''));
  tel.addEventListener('input', () => { tel.value = mascaraTel(tel.value); });

  // ----- botão e indicador do topo -----
  let carregado = false;
  function pintarTopo() {
    const aberta = abertoAgora();
    if (meu) {
      botao.disabled = false;
      botao.textContent = `Ver minha posição (${meu.posicao}º)`;
    } else if (aberta) {
      botao.disabled = false;
      botao.textContent = 'Entrar na fila';
    } else {
      botao.disabled = true;
      botao.textContent = `Fila abre às ${proximaAbertura()?.hora || '09h'}`;
    }
    // a linha existe sempre (aberta ou fechada): nada no topo pula quando os dados chegam
    info.classList.toggle('fila-ao-vivo--fechada', !aberta);
    info.querySelector('[data-fila-texto]').innerHTML = !aberta ? 'Fila fechada agora'
      : carregado ? resumo() : 'Consultando a fila…';
    agora.innerHTML = resumo();
  }

  // ----- tela "Você está na fila" -----
  function pintarTicket() {
    const frente = lista.filter((p) => p.posicao < meu.posicao);
    const proximo = meu.posicao === 1;
    const visivel = comMovimento() && dialogo.open && tela === 'ticket';
    // posição: o número antigo sobe e some, o novo sobe de baixo
    const pos = dialogo.querySelector('[data-fila-posicao]');
    const novaPos = `${meu.posicao}º`;
    if (visivel && pos.textContent && pos.textContent !== novaPos) {
      gsap.timeline()
        .to(pos, { yPercent: -40, opacity: 0, duration: 0.15, ease: SAI, onComplete: () => { pos.textContent = novaPos; } })
        .fromTo(pos, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3, ease: ENTRA, clearProps: 'transform,opacity' });
    } else {
      pos.textContent = novaPos;
    }
    // virou o próximo: o aviso aparece e pulsa 2 vezes
    const aviso = dialogo.querySelector('[data-fila-proximo]');
    const apareceu = proximo && aviso.hidden;
    aviso.hidden = !proximo;
    if (apareceu && visivel) {
      gsap.timeline()
        .from(aviso, { y: 8, opacity: 0, duration: 0.3, ease: ENTRA, clearProps: 'opacity' })
        .to(aviso, { scale: 1.03, duration: 0.25, ease: 'power1.inOut', yoyo: true, repeat: 3, clearProps: 'transform' });
    }
    dialogo.querySelector('[data-fila-espera]').innerHTML = proximo
      ? 'Assim que a cadeira liberar, é a sua vez.'
      : `Espera estimada: <strong>~${duracao(esperaDe(frente))}</strong> · ${frente.length} ${frente.length === 1 ? 'pessoa' : 'pessoas'} na sua frente`;
    // lista: quem continua na fila desliza para o novo lugar (FLIP); quem chegou aparece em fade
    const caixaLista = dialogo.querySelector('[data-fila-lista]');
    const antes = new Map(visivel ? [...caixaLista.children].map((li) => [li.dataset.id, li.getBoundingClientRect().top]) : []);
    caixaLista.innerHTML = lista.map((p) => {
      const voce = p.ticketId === ticketId;
      return `<li class="fila__item${voce ? ' fila__item--voce' : ''}" data-id="${escapar(p.ticketId)}"${voce ? ' aria-current="true"' : ''}>`
        + `<span class="fila__num">${p.posicao}º</span><span class="fila__nome">${voce ? 'Você' : escapar(p.nomeExibicao)}</span>`
        + `<span class="fila__servico">${p.servico ? escapar(p.servico) : ''}</span></li>`;
    }).join('');
    if (visivel && antes.size) {
      [...caixaLista.children].forEach((li) => {
        const topo = antes.get(li.dataset.id);
        if (topo === undefined) gsap.from(li, { opacity: 0, y: 8, duration: 0.3, ease: ENTRA, clearProps: 'transform,opacity' });
        else if (Math.abs(topo - li.getBoundingClientRect().top) > 1) {
          gsap.fromTo(li, { y: topo - li.getBoundingClientRect().top }, { y: 0, duration: 0.35, ease: ENTRA, clearProps: 'transform' });
        }
      });
    }
    // chegou a vez: vibra o celular uma vez (se o navegador deixar)
    if (proximo && !avisouProximo) { avisouProximo = true; navigator.vibrate?.([200, 100, 200]); }
    if (!proximo) avisouProximo = false;
  }

  // troca de tela (entrar <-> posição) com a mesma transição dos passos do agendamento
  function mostrar(nome, modo = nome) {
    const velha = telas.find((t) => !t.hidden);
    const nova = telas.find((t) => t.dataset.filaTela === nome);
    const trocar = () => {
      telas.forEach((t) => { t.hidden = t !== nova; });
      acoes.forEach((a) => { a.hidden = a.dataset.filaAcoes !== modo; });
    };
    tela = nome;
    if (velha === nova) { trocar(); return; }
    const dir = nome === 'ticket' ? 1 : -1;
    trocarConteudo(dialogo, velha, trocar, () => {
      entrarDe(nova, dir);
      nova.querySelector('.etapa__titulo')?.focus({ preventScroll: true });
    }, dir);
  }

  async function carregar() {
    try {
      [lista, meu] = await Promise.all([api.getQueue(), ticketId ? api.getMyTicket(ticketId) : null]);
    } catch { return; } // sem resposta: mantém o que está na tela e tenta no próximo ciclo
    carregado = true;
    if (ticketId && !meu) {
      // o ticket não existe mais (a vez passou ou saiu por outro aparelho)
      ticketId = null;
      gravarTicket(null);
      if (dialogo.open && tela === 'ticket') {
        mostrar('entrar');
        avisar('O seu lugar na fila foi encerrado. Se ainda quiser ser atendido, entre de novo.');
      }
    }
    pintarTopo();
    if (meu && dialogo.open && tela === 'ticket') pintarTicket();
  }

  // ----- abrir e fechar -----
  botao.addEventListener('click', () => {
    erro.hidden = true;
    // ao abrir, a tela certa já aparece sem transição (quem anima é a tela inteira)
    const nome = meu ? 'ticket' : 'entrar';
    tela = nome;
    telas.forEach((t) => { t.hidden = t.dataset.filaTela !== nome; });
    acoes.forEach((a) => { a.hidden = a.dataset.filaAcoes !== nome; });
    if (meu) pintarTicket(); else form.reset();
    abrirModal(dialogo);
    telas.find((t) => !t.hidden).querySelector('.etapa__titulo').focus({ preventScroll: true });
    carregar();
  });
  dialogo.querySelectorAll('[data-fila-fechar]').forEach((b) => b.addEventListener('click', () => fecharModal(dialogo)));
  // "Agende um horário": a fila desce e o agendamento abre por cima
  dialogo.querySelector('[data-agenda]')?.addEventListener('click', () => fecharModal(dialogo));

  // ----- entrar -----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (tela !== 'entrar' || btEntrar.disabled) return;
    erro.hidden = true;
    const nome = form.elements.nome.value.trim();
    const numero = tel.value.replace(/\D/g, '');
    if (!abertoAgora()) {
      const prox = proximaAbertura();
      return avisar(`A fila está fechada agora. Abre ${prox?.quando || ''} às ${prox?.hora || '09h'}.`);
    }
    if (nome.length < 2) return avisar('Escreva seu nome.');
    if (!/^\d{2}9\d{8}$/.test(numero)) return avisar('Confira o WhatsApp: DDD + número de celular, como (11) 91234-5678.');
    btEntrar.disabled = true;
    btEntrar.textContent = 'Entrando...';
    try {
      const t = await api.joinQueue({ nome, whatsapp: numero, servico: form.elements.servico.value || null });
      ticketId = t.ticketId;
      meu = t;
      avisouProximo = false;
      gravarTicket(ticketId);
      [lista, meu] = await Promise.all([api.getQueue(), api.getMyTicket(ticketId)]).catch(() => [lista, t]);
      carregado = true;
      pintarTopo();
      pintarTicket(); // monta a posição antes da troca, para a altura da tela acompanhar certo
      mostrar('ticket');
    } catch (err) {
      avisar(err.message || 'Não foi possível entrar na fila agora. Tente de novo.');
    } finally {
      btEntrar.disabled = false;
      btEntrar.textContent = 'Entrar na fila';
    }
  });

  // ----- sair (com confirmação) -----
  dialogo.querySelector('[data-fila-sair]').addEventListener('click', () => mostrar('ticket', 'confirmar'));
  dialogo.querySelector('[data-fila-nao]').addEventListener('click', () => mostrar('ticket'));
  dialogo.querySelector('[data-fila-sim]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await api.leaveQueue(ticketId);
      ticketId = null;
      meu = null;
      gravarTicket(null);
      form.reset();
      mostrar('entrar');
      avisar('Você saiu da fila.');
      await carregar();
    } catch {
      mostrar('ticket');
      avisar('Não foi possível sair da fila agora. Tente de novo.');
    } finally {
      b.disabled = false;
    }
  });

  // ----- atualização -----
  carregar();
  setInterval(() => { if (!document.hidden) carregar(); }, ATUALIZA);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(); });
})();

/* ---------- Barra fixa (celular): sobe de baixo depois que a pessoa passa do topo ----------
   Desce sozinha com qualquer tela por cima aberta (CSS: .modal-aberto). */
(function barraFixa() {
  const barra = document.querySelector('.barra-celular');
  const topo = document.querySelector('.hero');
  if (!barra || !topo || !('IntersectionObserver' in window)) return;
  const definir = (topoNaTela) => barra.classList.toggle('barra--fora', topoNaTela);
  definir(topo.getBoundingClientRect().bottom > 0);
  new IntersectionObserver(([e]) => definir(e.isIntersecting)).observe(topo);
})();

/* ---------- Mapa: carrega em segundo plano logo após a página abrir (ou antes, se a pessoa
   rolar até perto dele). Usa o endereço direto do embed, sem redirecionamento. ---------- */
const mapa = document.querySelector('[data-mapa]');
const comoChegar = document.querySelector('[data-como-chegar]');
if (preenchido(CONFIG.endereco)) {
  const q = encodeURIComponent(CONFIG.endereco);
  if (comoChegar) comoChegar.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  if (mapa) {
    let carregado = false;
    const carregarMapa = () => {
      if (carregado) return;
      carregado = true;
      const iframe = document.createElement('iframe');
      iframe.title = 'Mapa do Império Dantas';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.src = `https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1s${q}`;
      iframe.addEventListener('load', () => mapa.classList.add('mapa--pronto'));
      mapa.append(iframe);
    };
    // 1) se a pessoa rolar até perto do mapa, carrega na hora
    const perto = () => {
      const r = mapa.getBoundingClientRect();
      if (r.top < innerHeight * 2.5) { carregarMapa(); removeEventListener('scroll', perto); }
    };
    addEventListener('scroll', perto, { passive: true });
    // 2) senão, carrega sozinho em segundo plano depois que a página terminou de abrir
    addEventListener('load', () => {
      const agendar = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
      setTimeout(() => agendar(carregarMapa, { timeout: 2000 }), 2200);
    });
  }
}

/* ---------- Analytics: cliques de WhatsApp (liga no GA4 quando tiver) ---------- */
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-evento]');
  if (alvo && typeof window.gtag === 'function') window.gtag('event', 'clique_whatsapp', { local: alvo.dataset.evento });
});

/* ---------- Ano no rodapé ---------- */
document.querySelectorAll('[data-ano]').forEach((el) => { el.textContent = new Date().getFullYear(); });

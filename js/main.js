/* =====================================================================
   IMPÉRIO DANTAS · interações
   Para editar dados: CONFIG e HORARIOS logo abaixo.
   Os preços ficam no index.html (tabela de preços e JSON-LD).
   ===================================================================== */

const CONFIG = {
  whatsapp: '5511945046553',
  // endereço usado no mapa e no "Abrir no Google Maps"
  endereco: 'Estrada do Pequiá, 1828 - Vila Silviania, Carapicuíba - SP, 06381-095',
  // quem atende (aparece no passo 2 do agendamento) e em que área. Ao mudar, mudar também em api/_lib.js.
  // Valem só sem a API no ar: com ela, a lista vem da Equipe do painel.
  profissionais: ['Dantas', 'Larissa Mendes'], // FICTÍCIO: Larissa Mendes (profissional do cabelo feminino)
  areaDe: { Dantas: 'masculino', 'Larissa Mendes': 'feminino' },
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
// pausas fixas por dia da semana ({ 2: [['16:00', '17:00']] }) e fotos de quem atende: vêm do painel
const PAUSAS = {};
const FOTOS = {};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR');
const escapar = (txt) => String(txt).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const duracao = (t) => (t >= 60 ? `${Math.floor(t / 60)}h${t % 60 ? String(t % 60).padStart(2, '0') : ''}` : `${t} min`);
const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hora = (hhmm) => hhmm.replace(':00', 'h').replace(':', 'h');
const preenchido = (txt) => txt && !txt.includes('[');
const iniciais = (nome) => String(nome).split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const emailOk = (txt) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(txt).trim());
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
// celular: a barra de endereço aparecendo/sumindo não refaz todas as animações de rolagem (evita tranco)
if (window.ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true });
// links para seções da própria página: rolagem suave feita aqui, e não com scroll-behavior no CSS
// (o CSS animava também as correções internas do ScrollTrigger e a página escorregava sozinha)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  const id = a?.getAttribute('href').slice(1);
  const alvo = id && document.getElementById(id);
  if (!alvo || e.defaultPrevented) return;
  e.preventDefault();
  alvo.scrollIntoView({ behavior: REDUZIR ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
  // "Pular para o conteúdo": o foco do teclado vai junto
  if (a.classList.contains('pular')) {
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
  }
});
(function medidasEmDia() {
  if (!window.ScrollTrigger || !('ResizeObserver' in window)) return;
  let altura = 0;
  let espera = 0;
  const conferir = () => {
    const agora = document.querySelector('main')?.offsetHeight || 0;
    if (Math.abs(agora - altura) < 2) return; // só quando mudou de verdade (evita refazer sem parar)
    altura = agora;
    clearTimeout(espera);
    espera = setTimeout(() => { ScrollTrigger.refresh(); altura = document.querySelector('main')?.offsetHeight || 0; }, 200);
  };
  addEventListener('load', () => {
    altura = document.querySelector('main')?.offsetHeight || 0;
    new ResizeObserver(conferir).observe(document.querySelector('main'));
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  });
})();

// trava a rolagem da página (menu ou tela por cima). Conta quantas estão abertas
let travas = 0;
function travarRolagem(sim) {
  travas = Math.max(0, travas + (sim ? 1 : -1));
  document.documentElement.classList.toggle('travado', travas > 0);
}

/* ---------- Entrada no scroll: AnimatedContent (React Bits) adaptado para JavaScript puro ----------
   Mesmas opções do componente original: distance, direction, reverse, duration, ease, initialOpacity,
   animateOpacity, scale, blur, rotate, tilt, threshold, delay, stagger, staggerFrom, once e scrub.
   Com scrub, a animação fica presa à rolagem: entra conforme a pessoa desce e volta conforme sobe.
   "alvos" troca os filhos diretos por uma lista própria. Com "reduzir movimento", não anima. */
function animatedContent(el, o = {}) {
  if (!el || !comMovimento() || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const {
    distance = 100, direction = 'vertical', reverse = false, duration = 0.8, ease = 'power3.out',
    initialOpacity = 0, animateOpacity = true, scale = 1, blur = 0, rotate = 0, tilt = 0,
    threshold = 0.1, delay = 0, stagger = 0, staggerFrom = 'start', once = true, scrub = false, alvos,
  } = o;
  const lista = alvos ? [...alvos].filter(Boolean) : (stagger > 0 && el.children.length ? [...el.children] : [el]);
  if (!lista.length) return;
  const horizontal = direction === 'horizontal';
  const eixo = horizontal ? 'x' : 'y';
  const sinal = reverse ? -1 : 1;
  const de = { [eixo]: distance * sinal, scale, opacity: animateOpacity ? initialOpacity : 1 };
  const para = { [eixo]: 0, scale: 1, opacity: 1, duration, ease };
  if (blur > 0) { de.filter = `blur(${blur}px)`; para.filter = 'blur(0px)'; }
  if (rotate) { de.rotation = rotate * sinal; para.rotation = 0; }
  if (tilt) {
    const giro = horizontal ? 'rotationY' : 'rotationX';
    de[giro] = horizontal ? -tilt * sinal : tilt * sinal;
    para[giro] = 0;
    de.transformPerspective = 900;
    para.transformPerspective = 900;
  }
  if (stagger > 0) para.stagger = { each: stagger, from: staggerFrom };
  const inicio = `top ${(1 - threshold) * 100}%`;
  if (scrub) {
    // presa à rolagem (como no componente original): começa quando o topo do bloco entra na tela
    // e termina quando ele já subiu um bom pedaço; ao subir a página, volta pelo mesmo caminho
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    tl.fromTo(lista, de, { ...para, ease: 'power2.out' }, 0);
    ScrollTrigger.create({
      // clamp(): perto do fim da página (ex.: rodapé) o trecho encurta, para a animação sempre terminar
      trigger: el, start: `clamp(${inicio})`, end: `clamp(top ${Math.max((1 - threshold) * 100 - 45, 5)}%)`,
      scrub: scrub === true ? true : Math.max(Number(scrub) || 0, 0.01), animation: tl, invalidateOnRefresh: true,
    });
    return;
  }
  const tl = gsap.timeline({
    paused: true,
    // terminou: limpa o que o GSAP escreveu, para hover e :active do CSS voltarem a valer
    onComplete: () => gsap.set(lista, { clearProps: 'filter,transform,opacity' }),
  });
  tl.fromTo(lista, de, para, Math.max(delay, 0));
  ScrollTrigger.create({
    trigger: el, start: inicio, once,
    onEnter: () => tl.play(),
    onLeaveBack: once ? undefined : () => tl.reverse(),
  });
}

// o mesmo efeito em todo o site (teste pedido pelo dono). Para ajustar, mexer só aqui.
// No celular: menos distância e sem desfoque (o blur pesa em aparelho mais simples).
// Presa à rolagem (scrub): desce e entra, sobe e sai, sempre no ritmo de quem rola.
const ENTRADA = matchMedia('(max-width: 959px)').matches
  ? { distance: 40, duration: 0.7, ease: 'power3.out', stagger: 0.08, threshold: 0.08, scrub: 0.3 }
  : { distance: 80, duration: 0.8, ease: 'power3.out', stagger: 0.08, threshold: 0.08, scrub: 0.3 };
// sem desfoque (blur): ele é redesenhado a cada quadro e pesa; só posição e opacidade animam

// revela no scroll: o bloco "gatilho" entrando na tela anima os "itens" em cascata (e volta ao subir)
function revelar(gatilho, itens) {
  animatedContent(gatilho, { ...ENTRADA, alvos: itens });
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

// serviços: a tabela de preços do index.html é a fonte única (área vem do data-area do <li>)
const SERVICOS = [...document.querySelectorAll('.quadro [data-servico]')].map((a) => ({
  nome: a.dataset.servico, preco: Number(a.dataset.preco), min: Number(a.dataset.min),
  area: a.closest('[data-area]')?.dataset.area || 'ambos',
}));

/* ---------- Cabelo masculino | Cabelo feminino ----------
   Uma escolha só para o site inteiro: a tabela de preços, a galeria de trabalhos e o passo 1 do
   agendamento mostram o lado escolhido. "ambos" aparece nos dois. Os botões [data-area-escolher]
   ficam sincronizados. A troca anima: o lado atual some e o outro entra (só opacidade e posição). */
const AREA = { atual: 'masculino', ouvintes: [] };
const naArea = (area, alvo = AREA.atual) => !area || area === 'ambos' || area === alvo;
// área que os serviços pedem: 'masculino', 'feminino', null (qualquer) ou false (misturou os dois)
function areaDosServicos(lista) {
  const exclusivas = [...new Set(lista.map((x) => x.area).filter((a) => a && a !== 'ambos'))];
  return exclusivas.length > 1 ? false : exclusivas[0] || null;
}
const areaDaPessoa = (nome) => CONFIG.areaDe[nome] || 'ambos';
function mudarArea(nova, animar = true) {
  if (!['masculino', 'feminino'].includes(nova)) return;
  const antes = AREA.atual;
  AREA.atual = nova;
  document.querySelectorAll('[data-area-escolher]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.areaEscolher === nova)));
  if (antes === nova) return;
  const trocar = (caixa, aplicar) => {
    if (!caixa) return;
    if (!animar || !comMovimento()) { aplicar(); return; }
    gsap.killTweensOf(caixa);
    gsap.to(caixa, {
      opacity: 0, y: 10, duration: 0.18, ease: SAI,
      onComplete: () => {
        aplicar();
        gsap.fromTo(caixa, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: ENTRA, clearProps: 'transform,opacity' });
        if (window.ScrollTrigger) ScrollTrigger.refresh(); // as alturas mudaram: recalcula os efeitos de rolagem
      },
    });
  };
  // tabela de preços: grupos, sub-blocos e linhas com data-area
  const grupos = document.querySelector('[data-area-conteudo]');
  trocar(grupos, () => grupos.querySelectorAll('[data-area]').forEach((el) => { el.hidden = !naArea(el.dataset.area); }));
  // galeria de trabalhos: uma por área
  const galerias = [...document.querySelectorAll('[data-acordeao][data-area]')];
  if (galerias.length) trocar(galerias, () => galerias.forEach((g) => { g.hidden = g.dataset.area !== nova; }));
  AREA.ouvintes.forEach((fn) => fn(nova));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-area-escolher]');
  if (b) mudarArea(b.dataset.areaEscolher);
});
// começa no masculino (a tabela já vem montada; só esconde o lado feminino)
document.querySelectorAll('[data-area-conteudo] [data-area]').forEach((el) => { el.hidden = !naArea(el.dataset.area); });

// números do topo ("R$ 15 a R$ 150", "17 serviços") saem da própria tabela
function pintarResumoPrecos() {
  const precos = SERVICOS.map((x) => x.preco);
  const faixa = document.querySelector('[data-faixa-precos]');
  const qtd = document.querySelector('[data-qtd-servicos]');
  if (faixa && precos.length) faixa.textContent = `${brl(Math.min(...precos))} a ${brl(Math.max(...precos))}`;
  if (qtd) qtd.textContent = String(SERVICOS.length);
}
pintarResumoPrecos();

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

/* ---------- Dados do painel: preços, horários, pausas e quem atende ----------
   O index.html já vem com os valores de sempre (bom para o Google e para quem abre com internet
   ruim). Se o dono mudou alguma coisa no painel, /api/config traz o valor novo e a página se ajusta. */
const SEMANA_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function aplicarConfig(c) {
  (c.servicos || []).forEach((s) => {
    const bt = [...document.querySelectorAll('.quadro [data-servico]')].find((b) => b.dataset.servico === s.nome);
    const item = SERVICOS.find((x) => x.nome === s.nome);
    if (!bt || !item) return;
    item.preco = s.preco;
    item.min = s.min;
    if (s.area) item.area = s.area;
    bt.dataset.preco = s.preco;
    bt.dataset.min = s.min;
    bt.querySelector('.quadro__preco').textContent = brl(s.preco);
    bt.querySelector('.quadro__tempo').textContent = `${s.min} min`;
    bt.setAttribute('aria-label', `Agendar ${s.nome}, ${brl(s.preco)}, ${s.min} minutos`);
  });
  pintarResumoPrecos();
  if (c.horarios) {
    for (let d = 0; d < 7; d++) {
      HORARIOS[d] = c.horarios[d] || null;
      PAUSAS[d] = c.pausas?.[d] || [];
      const td = document.querySelector(`[data-dia-semana="${d}"] td`);
      if (td) {
        td.innerHTML = HORARIOS[d]
          ? `${hora(HORARIOS[d][0])} às ${hora(HORARIOS[d][1])}${PAUSAS[d].map(([a, b]) => `<span class="horario__pausa">pausa das ${hora(a)} às ${hora(b)}</span>`).join('')}`
          : 'Fechado';
      }
    }
    atualizarStatus();
  }
  if (c.profissionais?.length) {
    CONFIG.profissionais = c.profissionais.map((p) => p.nome);
    CONFIG.areaDe = Object.fromEntries(c.profissionais.map((p) => [p.nome, p.area || 'ambos']));
    c.profissionais.forEach((p) => { FOTOS[p.nome] = p.foto; });
  }
  // dados estruturados (Google) com os mesmos preços e horários
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].find((x) => x.textContent.includes('"HairSalon"'));
  if (!ld) return;
  try {
    const j = JSON.parse(ld.textContent);
    j.hasOfferCatalog?.itemListElement?.forEach((o) => {
      const s = SERVICOS.find((x) => x.nome === o.itemOffered?.name);
      if (s) o.price = String(s.preco);
    });
    const precos = SERVICOS.map((s) => s.preco);
    j.priceRange = `R$ ${Math.min(...precos)} - R$ ${Math.max(...precos)}`;
    j.openingHoursSpecification = SEMANA_EN.map((dia, d) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: dia, opens: HORARIOS[d]?.[0] || '00:00', closes: HORARIOS[d]?.[1] || '00:00',
    }));
    ld.textContent = JSON.stringify(j);
  } catch { /* fica o que veio no HTML */ }
}
const configPronta = (async () => {
  if (!CONFIG.api) return;
  try {
    const r = await fetch(`${CONFIG.api}/config`, { headers: { Accept: 'application/json' } });
    if (r.ok) aplicarConfig(await r.json());
  } catch { /* sem API: valem os dados do HTML */ }
})();

/* ---------- Conta: botão do topo ----------
   Sem login mostra "Entrar"; com login, as iniciais (e quem é da equipe vai para o painel). */
const sessao = { conta: null };
function pintarContaTopo() {
  const a = document.querySelector('[data-conta-link]');
  if (!a) return;
  const c = sessao.conta;
  const equipe = c && c.papel !== 'cliente';
  a.classList.toggle('nav__conta--logado', Boolean(c));
  a.href = equipe ? 'painel.html' : 'entrar.html';
  a.querySelector('[data-conta-txt]').textContent = c ? (equipe ? 'Painel' : c.nome.split(' ')[0]) : 'Entrar';
  a.setAttribute('aria-label', c ? (equipe ? `Abrir o painel (${c.nome})` : `Sua conta: ${c.nome}`) : 'Entrar na sua conta');
  a.querySelector('[data-conta-icone]').innerHTML = c ? escapar(iniciais(c.nome)) : '<svg viewBox="0 0 24 24"><use href="#i-conta"/></svg>';
}
const sessaoPronta = (async () => {
  if (!CONFIG.api) return;
  try {
    const r = await fetch(`${CONFIG.api}/conta`, { headers: { Accept: 'application/json' } });
    if (r.ok) { sessao.conta = (await r.json()).conta; pintarContaTopo(); }
  } catch { /* sem API: fica "Entrar" */ }
})();

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
  // a abertura não segura o toque: o primeiro toque em qualquer lugar a tira e já vale
  // (ex.: tocar no menu durante a abertura abre o menu)
  const pular = () => { intro.classList.add('intro--sai'); iniciarTopo(); };
  addEventListener('pointerdown', pular, { once: true, capture: true });
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
  // tocar fora do painel (logo, botões de agendar, barra de baixo) também fecha e destrava a página
  document.addEventListener('click', (e) => { if (aberto && !e.target.closest('[data-menu], #menu')) fechar(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches) fechar(); });
}

/* ---------- Tabela de preços: a placa aparece e o conteúdo entra em cascata curta (uma vez) ---------- */
(function animarTabela() {
  const placa = document.querySelector('.quadro__placa');
  if (!placa || !comMovimento() || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const topo = placa.querySelectorAll('.quadro__topo > *');
  const grupos = [...placa.querySelectorAll('.quadro__grupo')];
  const glossario = placa.querySelector('.quadro__glossario');
  gsap.matchMedia().add({ desk: '(min-width: 960px)', mob: '(max-width: 959px)' }, (ctx) => {
    // presa à rolagem (desce e entra, sobe e sai), como o resto do site
    const entrada = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: { trigger: placa, start: 'top 92%', end: ctx.conditions.desk ? 'top 35%' : 'top 55%', scrub: 0.3, invalidateOnRefresh: true },
    })
      .fromTo(placa, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    if (ctx.conditions.desk) {
      // desktop: a placa inteira cabe na tela, então tudo entra junto em cascata curta
      // mesma entrada do resto do site (ENTRADA, lá em cima)
      entrada.fromTo([...topo, ...grupos, glossario],
        { y: ENTRADA.distance, opacity: 0 },
        { y: 0, opacity: 1, duration: ENTRADA.duration, stagger: ENTRADA.stagger }, 0.08);
      return;
    }
    // celular: a placa é bem mais alta que a tela. O topo entra com ela; depois cada linha
    // acompanha a barra de rolagem (exceção pedida à regra "nada preso ao scroll no celular"):
    // nome e tempo vêm da esquerda, o preço da direita, e tudo volta se a pessoa rolar para cima
    entrada.fromTo(topo, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: cascata() }, 0.08);
    const rolagem = (alvo) => ({ trigger: alvo, start: 'top 96%', end: 'top 72%', scrub: 0.4, invalidateOnRefresh: true });
    placa.querySelectorAll('.quadro__grupo h3').forEach((h3) => {
      gsap.fromTo(h3, { y: 16, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: rolagem(h3) });
    });
    placa.querySelectorAll('.quadro__grupo li').forEach((li) => {
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: rolagem(li) })
        .fromTo(li.querySelectorAll('.quadro__nome, .quadro__tempo'), { x: -24, opacity: 0 }, { x: 0, opacity: 1 }, 0)
        .fromTo(li.querySelector('.quadro__preco'), { x: 24, opacity: 0 }, { x: 0, opacity: 1 }, 0);
    });
    revelar(glossario, [glossario]);
  });
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

/* ---------- Sobreposição: a tabela de preços sobe por cima do topo ----------
   Só no computador (onde o topo tem a altura exata da tela; ver .sobrepor no CSS). Enquanto a
   tabela sobe, o topo recua um pouco e escurece, como se ficasse para trás. Só transform e opacity. */
(function sobreposicao() {
  const topo = document.querySelector('.sobrepor .hero');
  const tabela = document.querySelector('.sobrepor .quadro');
  if (!topo || !tabela || !comMovimento() || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(min-width: 960px) and (min-height: 620px)', () => {
    gsap.fromTo(topo, { scale: 1, opacity: 1 }, {
      scale: 0.94, opacity: 0.35, ease: 'none', transformOrigin: '50% 40%', immediateRender: false,
      scrollTrigger: { trigger: tabela, start: 'top bottom', end: 'top top+=72', scrub: true },
    });
  });
})();

/* ---------- Saída da tabela de preços: a placa preta vira a próxima seção ----------
   Computador: a tabela para na tela; rolando, o texto da placa some aos poucos e a placa preta
   cresce até cobrir a tela. Como "Trabalhos da casa" também é preta, a passagem fica sem corte.
   Tudo preso à rolagem (scrub com folga), então anda no ritmo de quem rola e volta ao subir. */
(function saidaDaTabela() {
  const secao = document.querySelector('.sobrepor .quadro');
  const placa = secao?.querySelector('.quadro__placa');
  if (!placa || !comMovimento() || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(min-width: 960px) and (min-height: 620px)', () => {
    const conteudo = placa.querySelectorAll('.quadro__topo, .quadro__grupo, .quadro__glossario');
    // quanto a placa precisa crescer para passar das bordas da tela (com folga, a moldura sai de vista)
    const cobrir = () => Math.max(innerWidth / placa.offsetWidth, innerHeight / placa.offsetHeight) * 1.25;
    // a seção seguinte começa por baixo da placa já crescida: assim que o zoom termina,
    // "Trabalhos da casa" sobe por cima do preto, sem uma tela vazia no meio
    const invol = secao.closest('.sobrepor');
    const encaixar = () => { invol.style.marginBottom = `-${secao.offsetHeight}px`; };
    encaixar();
    ScrollTrigger.addEventListener('refreshInit', encaixar);
    // rolagem: 1,2 tela para o texto sumir e a placa crescer + 1 tela parada no preto,
    // que é quando a próxima seção sobe
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        // placa mais alta que a tela (ex.: lado feminino, com mais serviços): só para quando a última
        // linha já apareceu; senão o texto começaria a sumir antes de a pessoa ver tudo
        trigger: secao,
        start: () => {
          const nav = document.querySelector('.nav')?.offsetHeight || 72;
          return secao.offsetHeight > innerHeight - nav ? 'bottom bottom' : `top top+=${nav}`;
        },
        end: () => `+=${innerHeight * 1.2 + secao.offsetHeight}`,
        // scrub: true = colado na barra de rolagem, sem atraso. Com atraso, ao subir rápido a tabela
        // destravava enquanto a placa ainda estava grande, e uma placa gigante passava pela tela.
        // (sem anticipatePin: ele trava cedo demais e a tabela dá um salto ao rolar devagar)
        pin: true, scrub: true, invalidateOnRefresh: true,
      },
    })
      .fromTo(conteudo, { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.4, stagger: 0.04, immediateRender: false })
      .fromTo(placa, { scale: 1 }, { scale: cobrir, duration: 0.6, ease: 'power2.in', immediateRender: false }, 0.32)
      .to({}, { duration: 0.75 }); // a parte parada no preto
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', encaixar);
      invol.style.marginBottom = '';
    };
  });
})();

/* ---------- Trabalhos da casa: título, texto e fotos entram com fade e leve subida (uma vez) ---------- */
(function animarTrabalhos() {
  const sec = document.getElementById('trabalhos');
  if (!sec) return;
  revelar(sec.querySelector('.trabalhos__topo'), sec.querySelectorAll('.trabalhos__topo > *'));
  revelar(sec.querySelector('.acordeao'), sec.querySelectorAll('.acordeao > .ag-panel'));
})();

/* ---------- Acordeão de fotos: AccordionGallery (React Bits) adaptado para JavaScript puro ----------
   Mesma animação do original: a foto escolhida cresce (expandRatio), as outras se inclinam em 3D
   (tilt), ficam em preto e branco e escurecem; a imagem desliza por dentro (parallax) e a legenda
   entra com a barrinha. Mouse em cima abre (trigger "hover"); toque e teclado também.
   Clique numa foto fechada só abre ela; clique na aberta amplia (ver "Foto ampliada"). */
function acordeao(root, o = {}) {
  const {
    defaultIndex = 2, expandRatio = 0.52, duration = 0.6, ease = 'power3.out', parallax = 0.5,
    tilt = 8, stagger = 0.06, trigger = 'hover', grayscale = true, showLabels = true,
    aspect = 0, // largura ÷ altura das fotos. Com valor, a foto aberta fica nesse formato e aparece inteira
  } = o;
  const panels = [...root.querySelectorAll('.ag-panel')];
  const count = panels.length;
  if (!count || !window.gsap) return;
  const media = panels.map((p) => p.querySelector('.ag-panel__media'));
  // leveza: a cor e o escurecido são camadas que só mudam de opacidade (sem filtro animado)
  const cor = panels.map((p) => p.querySelector('.ag-panel__cor'));
  const sombra = panels.map((p) => p.querySelector('.ag-panel__sombra'));
  const legendas = panels.map((p) => [...p.querySelectorAll('.ag-panel__bar, .ag-panel__text, .ag-panel__quero')]);
  gsap.set(media, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // celular: em coluna (as fotos empilhadas e a escolhida cresce para baixo)
  const coluna = matchMedia('(max-width: 640px)');
  let vertical = coluna.matches;
  let active = Math.min(Math.max(defaultIndex, 0), count - 1);
  let tl = null;
  let primeira = true;
  let mediaSize = 320;
  let ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);

  function aplicar(animar) {
    const r = ratio;
    const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
    tl?.kill();
    const dur = animar && !reduzido ? duration : 0;
    tl = gsap.timeline();
    panels.forEach((panel, i) => {
      const ativo = i === active;
      panel.classList.toggle('ag-panel--active', ativo);
      if (ativo) panel.setAttribute('aria-current', 'true'); else panel.removeAttribute('aria-current');
      panel.querySelector('.ag-panel__quero').tabIndex = ativo ? 0 : -1;
      const rot = ativo ? 0 : i < active ? tilt : -tilt;
      tl.to(panel, { flexGrow: ativo ? grow : 1, ...(vertical ? { rotateX: -rot, rotateY: 0 } : { rotateY: rot, rotateX: 0 }), duration: dur, ease }, 0);
      const drift = Math.max(-1.5, Math.min(1.5, active - i));
      const shift = drift * parallax * mediaSize * 0.06;
      tl.to(media[i], { x: vertical ? 0 : ativo ? 0 : shift, y: vertical ? (ativo ? 0 : shift) : 0, duration: dur, ease }, 0);
      tl.to(cor[i], { opacity: !grayscale || ativo ? 1 : 0, duration: dur, ease }, 0);
      tl.to(sombra[i], { opacity: ativo ? 0 : 0.35, duration: dur, ease }, 0);
      if (!showLabels) return;
      if (ativo) tl.to(legendas[i], { opacity: 1, x: 0, duration: dur, ease, stagger: reduzido ? 0 : stagger }, 0);
      else tl.to(legendas[i], { opacity: 0, x: -14, duration: dur * 0.6, ease }, 0);
    });
  }

  function medir() {
    root.classList.toggle('acordeao--vertical', vertical);
    const gap = parseFloat(getComputedStyle(root).rowGap || getComputedStyle(root).gap) || 10;
    if (aspect > 0) {
      // a foto aberta no formato exato da imagem: nada do corte fica de fora
      if (vertical) {
        // coluna: a aberta ocupa a largura toda; a altura da coluna acompanha (fechadas com 56 px)
        const aberta = root.clientWidth / aspect;
        root.style.height = `${Math.round(aberta + (count - 1) * (56 + gap))}px`;
        mediaSize = aberta;
        ratio = aberta / (aberta + (count - 1) * 56);
      } else {
        root.style.height = '';
        const usable = Math.max(root.clientWidth - gap * (count - 1), 120);
        const aberta = Math.min(root.clientHeight * aspect, usable * 0.9);
        mediaSize = aberta;
        ratio = Math.min(Math.max(aberta / usable, 0.2), 0.9);
      }
    } else {
      const rect = root.getBoundingClientRect();
      const usable = Math.max((vertical ? rect.height : rect.width) - gap * (count - 1), 120);
      ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);
      mediaSize = Math.max(140, usable * ratio * 1.22);
    }
    root.style.setProperty('--ag-media-size', `${mediaSize}px`);
    aplicar(!primeira);
  }
  const escolher = (i) => {
    if (i === active) return;
    active = i;
    aplicar(true);
  };

  panels.forEach((panel, i) => {
    panel.addEventListener('mouseenter', () => { if (trigger === 'hover' && matchMedia('(hover: hover)').matches) escolher(i); });
    // guarda se a foto já estava aberta quando o dedo/mouse encostou (o foco abre antes do clique).
    // Fechada: o clique só abre ela; aberta: o clique amplia (ver "Foto ampliada")
    panel.addEventListener('pointerdown', () => { panel.dataset.pronta = i === active ? '1' : ''; });
    panel.addEventListener('click', () => escolher(i));
    panel.addEventListener('focus', () => escolher(i));
    panel.addEventListener('keydown', (e) => {
      const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (passo) {
        e.preventDefault();
        panels[(i + passo + count) % count].focus();
      } else if ((e.key === 'Enter' || e.key === ' ') && e.target === panel) {
        e.preventDefault();
        panel.dataset.pronta = '1';
        panel.click(); // Enter na foto aberta amplia
      }
    });
  });
  coluna.addEventListener('change', (e) => { vertical = e.matches; medir(); });
  new ResizeObserver(medir).observe(root);
  medir();
  primeira = false;
}
// as fotos dos trabalhos são em pé (600 × 800): a aberta fica 3:4 e mostra o corte inteiro
document.querySelectorAll('[data-acordeao]').forEach((g) => acordeao(g, { defaultIndex: 2, trigger: 'hover', aspect: 3 / 4 }));

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
// Dúvidas: o título (à esquerda) vem da esquerda e as perguntas (à direita) vêm da direita,
// uma de cada vez, mais devagar que o resto para dar tempo de ver o movimento
(function entradaDuvidas() {
  const sec = document.querySelector('.duvidas');
  if (!sec) return;
  const lento = { duration: 1.3, ease: 'power3.out', threshold: 0.1, scrub: 0.4 };
  const longe = matchMedia('(max-width: 959px)').matches ? 60 : 140;
  animatedContent(sec, { ...lento, direction: 'horizontal', reverse: true, distance: longe, alvos: sec.querySelectorAll('.titulo') });
  animatedContent(sec, { ...lento, direction: 'horizontal', distance: longe, stagger: 0.18, delay: 0.15, alvos: sec.querySelectorAll('.duvidas__lista details') });
})();

/* ---------- Horário e rodapé: a mesma entrada do resto do site ---------- */
revelar(document.querySelector('.horario'), document.querySelectorAll('.horario__tabela > *, .horario__local > *'));
revelar(document.querySelector('.rodape'), document.querySelectorAll('.rodape > *'));

/* ---------- Foto ampliada ---------- */
const dialogo = document.querySelector('[data-ampliada]');
if (dialogo && typeof dialogo.showModal === 'function') {
  const img = document.createElement('img');
  img.width = 1200;
  img.height = 1600;
  img.decoding = 'async';
  dialogo.prepend(img);
  document.querySelectorAll('[data-ampliar]').forEach((b) => b.addEventListener('click', (e) => {
    // no acordeão: "Quero esse" agenda, e foto fechada só abre (o primeiro toque não amplia)
    if (e.target.closest('[data-quero]')) return;
    if (b.classList.contains('ag-panel') && !b.dataset.pronta) return;
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

  // ----- passo 1: serviços (vêm da tabela de preços, já com os valores do painel) -----
  // só os serviços do lado escolhido (cabelo masculino ou feminino); os marcados que servem continuam marcados
  function montarServicos() {
    const antes = new Set(marcados().map((x) => x.nome));
    dialogo.querySelector('[data-agenda-servicos]').innerHTML = SERVICOS.map((s, i) => (naArea(s.area) ? `
      <label class="opcao"><input type="checkbox" name="servico" value="${i}"${antes.has(s.nome) ? ' checked' : ''}>
        <span class="opcao__caixa"><strong>${s.nome}</strong><small>${s.min} min · ${brl(s.preco)}</small></span></label>` : '')).join('');
  }
  // quem atende o que foi escolhido: no feminino, quem atende cabelo feminino; no masculino, os barbeiros
  const equipeDaVez = () => {
    const pede = areaDosServicos(marcados()) || AREA.atual;
    return CONFIG.profissionais.filter((n) => naArea(areaDaPessoa(n), pede));
  };

  // ----- passo 2: profissionais (com a foto enviada no painel; sem foto, as iniciais) -----
  function montarProfissionais() {
    const rosto = (n) => (FOTOS[n]
      ? `<span class="opcao__sigla opcao__sigla--foto" aria-hidden="true"><img src="${escapar(FOTOS[n])}" alt="" width="56" height="56" loading="lazy" decoding="async"></span>`
      : `<span class="opcao__sigla" aria-hidden="true">${escapar(iniciais(n))}</span>`);
    const equipe = equipeDaVez();
    const escolhido = valor('profissional');
    dialogo.querySelector('[data-agenda-profissionais]').innerHTML = [
      ...equipe.map((n) => `
        <label class="opcao"><input type="radio" name="profissional" value="${escapar(n)}">
          <span class="opcao__caixa opcao__caixa--pessoa">${rosto(n)}<strong>${escapar(n)}</strong></span></label>`),
      ...(equipe.length > 1 ? [`<label class="opcao"><input type="radio" name="profissional" value="${SEM_PREF}">
          <span class="opcao__caixa opcao__caixa--pessoa"><span class="opcao__sigla" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-conta"/></svg></span><strong>${SEM_PREF}</strong><small>Quem estiver livre no horário</small></span></label>`] : []),
    ].join('');
    // a escolha anterior continua se ainda servir; com uma pessoa só, ela já vem marcada
    const radios = [...form.querySelectorAll('input[name="profissional"]')];
    const manter = radios.find((r) => r.value === escolhido);
    if (manter) manter.checked = true;
    else if (equipe.length === 1 && radios[0]) radios[0].checked = true;
  }
  const marcados = () => [...form.querySelectorAll('input[name="servico"]:checked')].map((c) => SERVICOS[Number(c.value)]);
  const duracaoTotal = () => marcados().reduce((t, s) => t + s.min, 0);
  const valor = (nome) => form.querySelector(`input[name="${nome}"]:checked`)?.value || '';
  montarServicos();
  montarProfissionais();
  // trocou masculino/feminino com o agendamento aberto: refaz a lista de serviços
  AREA.ouvintes.push(() => { if (dialogo.open) { montarServicos(); atualizar(); } });

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
    const pessoas = quem && quem !== SEM_PREF ? [quem] : equipeDaVez();
    // livre se pelo menos uma das pessoas possíveis não tem nada sobreposto
    // profissional null = pausa ou folga de todo mundo
    return pessoas.some((p) => !ocupados.some((o) => (o.profissional === p || o.profissional === null) && t < minutos(o.fim) && fim > minutos(o.inicio)));
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
    resumo.innerHTML = linhas.map(([k, v]) => `<div data-revela><dt>${k}</dt><dd>${escapar(v)}</dd></div>`).join('')
      + `<div class="resumo__total" data-revela><dt>Total</dt><dd>${brl(lista.reduce((t, s) => t + s.preco, 0))}</dd></div>`;
  }

  const tel = form.elements.telefone;
  tel.addEventListener('input', () => { tel.value = mascaraTel(tel.value); });

  // ----- passo 4: conta (logado só confirma; senão "Primeira vez" cria a conta e "Já tenho conta" entra) -----
  let modoConta = 'cadastrar';
  function pintarLogin() {
    const c = sessao.conta;
    dialogo.querySelector('[data-conta-logado]').hidden = !c;
    dialogo.querySelector('[data-conta-form]').hidden = Boolean(c);
    if (c) {
      dialogo.querySelector('[data-conta-ini]').textContent = iniciais(c.nome);
      dialogo.querySelector('[data-conta-nome-ag]').textContent = c.nome;
      dialogo.querySelector('[data-conta-email-ag]').textContent = c.email;
    }
    dialogo.querySelectorAll('[data-conta-modo]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.contaModo === modoConta)));
    dialogo.querySelectorAll('[data-so-modo]').forEach((el) => { el.hidden = el.dataset.soModo !== modoConta; });
    form.elements.senha.autocomplete = modoConta === 'cadastrar' ? 'new-password' : 'current-password';
  }
  dialogo.querySelectorAll('[data-conta-modo]').forEach((b) => b.addEventListener('click', () => {
    modoConta = b.dataset.contaModo;
    erro.hidden = true;
    pintarLogin();
    atualizar();
  }));
  dialogo.querySelector('[data-conta-sair]').addEventListener('click', async () => {
    try {
      await fetch(`${CONFIG.api}/conta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'sair' }) });
    } catch { /* segue */ }
    sessao.conta = null;
    modoConta = 'entrar';
    pintarContaTopo();
    pintarLogin();
    atualizar();
  });

  function valido(p) {
    if (p === 1) return marcados().length > 0;
    if (p === 2) return Boolean(valor('profissional'));
    if (p === 3) return Boolean(diaSel && valor('hora'));
    if (p === 4) {
      if (sessao.conta) return true;
      const f = form.elements;
      if (modoConta === 'entrar') return emailOk(f.email.value) && f.senha.value.length > 0;
      return f.nome.value.trim().length >= 2 && tel.value.replace(/\D/g, '').length >= 10 && emailOk(f.email.value) && f.senha.value.length >= 8;
    }
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
    btAvancar.textContent = n === 4 ? rotuloConfirmar() : n === 5 ? 'Fechar' : 'Continuar';
    erro.hidden = true;
    if (n === 2) montarProfissionais(); // depende dos serviços escolhidos no passo 1
    if (n === 3) montarDias();
    if (n === 4) { montarResumo(); pintarLogin(); }
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

  // no celular o botão fica curto para caber numa linha ao lado do total
  function rotuloConfirmar() { return matchMedia('(max-width: 480px)').matches ? 'Confirmar' : 'Confirmar agendamento'; }
  const mostrarErro = (txt) => {
    enviando = false;
    btAvancar.textContent = rotuloConfirmar();
    erro.textContent = txt;
    erro.hidden = false;
    atualizar();
  };

  async function confirmar() {
    const lista = marcados();
    const f = form.elements;
    const dados = {
      servicos: lista.map((s) => s.nome),
      profissional: valor('profissional'),
      data: diaSel,
      hora: valor('hora'),
      nome: f.nome.value.trim(),
      telefone: tel.value.replace(/\D/g, ''),
      telefoneTxt: tel.value,
      total: lista.reduce((t, s) => t + s.preco, 0),
      min: duracaoTotal(),
    };

    let salvo = false;
    if (CONFIG.api) {
      enviando = true;
      erro.hidden = true;
      atualizar();
      // sem login: entra ou cria a conta primeiro
      if (!sessao.conta) {
        btAvancar.textContent = modoConta === 'entrar' ? 'Entrando...' : 'Criando sua conta...';
        try {
          const corpo = modoConta === 'entrar'
            ? { acao: 'entrar', email: f.email.value, senha: f.senha.value }
            : { acao: 'cadastrar', nome: dados.nome, telefone: dados.telefone, email: f.email.value, senha: f.senha.value };
          const r = await fetch(`${CONFIG.api}/conta`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(corpo),
          });
          const resposta = await r.json().catch(() => ({}));
          if (r.ok && resposta.conta) {
            sessao.conta = resposta.conta;
            pintarContaTopo();
          } else if (r.status < 500 && r.status !== 404) {
            if (r.status === 409) modoConta = 'entrar'; // e-mail já tem conta: troca para "Já tenho conta"
            pintarLogin();
            return mostrarErro(resposta.erro || 'Confira seus dados e tente de novo.');
          }
        } catch { /* sem conexão: segue pelo WhatsApp */ }
      }
      if (sessao.conta) {
        dados.nome = sessao.conta.nome;
        if (sessao.conta.telefone) { dados.telefone = sessao.conta.telefone; dados.telefoneTxt = mascaraTel(sessao.conta.telefone); }
      }
      btAvancar.textContent = 'Salvando...';
      if (sessao.conta) try {
        const r = await fetch(`${CONFIG.api}/agendamentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            servicos: dados.servicos, profissional: dados.profissional, data: dados.data, hora: dados.hora,
            telefone: dados.telefone, site: form.elements.site.value,
          }),
        });
        const resposta = await r.json().catch(() => ({}));
        if (r.ok) {
          salvo = true;
          if (resposta.profissional) dados.profissional = resposta.profissional;
        } else if (r.status === 401) {
          // a sessão caiu no meio do caminho: pede para entrar de novo
          sessao.conta = null;
          modoConta = 'entrar';
          pintarContaTopo();
          pintarLogin();
          return mostrarErro(resposta.erro || 'Entre na sua conta para confirmar.');
        } else if ([400, 409, 429].includes(r.status)) {
          // erro que a pessoa consegue resolver: mostra e deixa corrigir
          enviando = false;
          const txt = resposta.erro || 'Não foi possível confirmar. Tente de novo.';
          if (r.status === 409) {
            delete ocupadosPorDia[dados.data]; // busca de novo o que está ocupado
            irPara(3);
            montarHoras(txt);
          } else {
            btAvancar.textContent = rotuloConfirmar();
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
    const primeiroNome = dados.nome.split(' ')[0] || 'quase lá';
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
    // abriu por um serviço só de um lado (ex.: "Corte feminino"): o agendamento já vai para esse lado
    const lado = areaDosServicos(SERVICOS.filter((x) => nomes.includes(x.nome)));
    if (lado) mudarArea(lado, false);
    montarServicos();
    montarProfissionais();
    modoConta = 'cadastrar';
    diaSel = '';
    enviando = false;
    form.querySelectorAll('input[name="servico"]').forEach((c) => {
      c.checked = nomes.includes(SERVICOS[Number(c.value)].nome);
    });
    montarProfissionais(); // com os serviços já marcados (e uma pessoa só, ela vem marcada)
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

  // index.html#agendar (vem da página "Minha conta") abre o agendamento direto
  if (location.hash === '#agendar') {
    history.replaceState(null, '', location.pathname + location.search);
    Promise.all([configPronta, sessaoPronta]).then(() => abrir([], false));
  }
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

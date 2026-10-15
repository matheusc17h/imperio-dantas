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
const SEMANA_CURTA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR');
const escapar = (txt) => String(txt).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const duracao = (t) => (t >= 60 ? `${Math.floor(t / 60)}h${t % 60 ? String(t % 60).padStart(2, '0') : ''}` : `${t} min`);
const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hora = (hhmm) => hhmm.replace(':00', 'h').replace(':', 'h');
const preenchido = (txt) => txt && !txt.includes('[');

// serviços: a tabela de preços do index.html é a fonte única
const SERVICOS = [...document.querySelectorAll('.quadro [data-servico]')].map((a) => ({
  nome: a.dataset.servico, preco: Number(a.dataset.preco), min: Number(a.dataset.min),
}));

/* ---------- WhatsApp: um lugar só para montar os links ---------- */
function linkWhatsApp(mensagem) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

document.querySelectorAll('[data-wa]').forEach((a) => { a.href = linkWhatsApp(a.dataset.wa); });
// Cartões e tabela: mensagem com nome e preço do serviço. O clique abre a tela de agendamento;
// este link é o caminho reserva (navegador sem suporte à tela).
const mensagemServico = (nome) => {
  const s = SERVICOS.find((x) => x.nome === nome);
  return `Olá! Vim pelo site e quero agendar: ${nome}${s ? ` (${brl(s.preco)})` : ''}.`;
};
document.querySelectorAll('[data-agendar]').forEach((a) => { a.href = linkWhatsApp(mensagemServico(a.dataset.agendar)); });
document.querySelectorAll('[data-servico]').forEach((a) => {
  const { servico, preco, min } = a.dataset;
  a.href = linkWhatsApp(mensagemServico(servico));
  a.setAttribute('aria-label', `Agendar ${servico}, ${brl(Number(preco))}, ${min} minutos`);
});

/* ---------- Tempos: a tabela de preços (data-min) é a fonte única ----------
   Repete o tempo na própria tabela, nos cartões, no FAQ e no JSON-LD do FAQ. */
document.querySelectorAll('.quadro [data-servico] .quadro__tempo').forEach((el) => {
  el.textContent = `${el.closest('[data-servico]').dataset.min} min`;
});
document.querySelectorAll('[data-tempo-de]').forEach((el) => {
  const s = SERVICOS.find((x) => x.nome === el.dataset.tempoDe);
  if (s) el.textContent = `${s.min} ${el.dataset.unidade || 'min'}`;
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
document.querySelectorAll('[data-quero]').forEach((a) => {
  a.setAttribute('aria-label', `Quero esse: ${a.dataset.quero}. Abrir o agendamento com o serviço marcado`);
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
function atualizarStatus() {
  const alvo = document.querySelector('[data-status]');
  if (!alvo) return;
  const { dia, min } = agoraSP();
  const hoje = HORARIOS[dia];
  const aberto = hoje && min >= minutos(hoje[0]) && min < minutos(hoje[1]);
  document.body.classList.toggle('aberto', Boolean(aberto));

  if (aberto) {
    alvo.textContent = `Aberto agora, fecha às ${hora(hoje[1])}`;
    return;
  }
  // próximo horário de abertura
  for (let i = 0; i < 8; i++) {
    const d = (dia + i) % 7;
    const h = HORARIOS[d];
    if (!h) continue;
    if (i === 0 && min >= minutos(h[0])) continue;
    const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[d];
    alvo.textContent = `Fechado agora, abre ${quando} às ${hora(h[0])}`;
    return;
  }
}
atualizarStatus();
setInterval(atualizarStatus, 60 * 1000);
document.querySelector(`[data-dia-semana="${agoraSP().dia}"]`)?.classList.add('hoje');

/* ---------- Pré-loader: toque, clique ou tecla pula ---------- */
const intro = document.querySelector('[data-intro]');
if (intro) {
  const fim = () => intro.classList.add('intro--fim');
  intro.addEventListener('click', fim);
  intro.addEventListener('animationend', (e) => { if (e.animationName === 'intro-sai') fim(); });
  addEventListener('keydown', fim, { once: true });
  // sai quando o HTML está pronto (não espera as imagens), depois de no mínimo 0,6s para a logo se montar.
  // O CSS tira a tela sozinho em 1s, mesmo se o JS falhar.
  const sair = () => setTimeout(() => intro.classList.add('intro--sai'), Math.max(0, 600 - performance.now()));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sair); else sair();
}

/* ---------- Menu (celular) ---------- */
const botaoMenu = document.querySelector('[data-menu]');
const menu = document.getElementById('menu');
if (botaoMenu && menu) {
  const fechar = () => {
    menu.classList.remove('aberto');
    botaoMenu.setAttribute('aria-expanded', 'false');
    botaoMenu.setAttribute('aria-label', 'Abrir menu');
  };
  botaoMenu.addEventListener('click', () => {
    const abrir = !menu.classList.contains('aberto');
    menu.classList.toggle('aberto', abrir);
    botaoMenu.setAttribute('aria-expanded', String(abrir));
    botaoMenu.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', fechar));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
}

/* ---------- Carrossel de serviços (setas no desktop) ---------- */
const trilho = document.querySelector('[data-trilho]');
const setas = document.querySelectorAll('[data-seta]');
if (trilho && setas.length) {
  const passo = () => (trilho.firstElementChild?.getBoundingClientRect().width || 280) + 24;
  setas.forEach((b) => b.addEventListener('click', () => trilho.scrollBy({ left: passo() * Number(b.dataset.seta), behavior: 'smooth' })));
  const estado = () => {
    setas[0].disabled = trilho.scrollLeft <= 4;
    setas[1].disabled = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
  };
  trilho.addEventListener('scroll', estado, { passive: true });
  addEventListener('resize', estado);
  estado();
}

/* ---------- Tabela de preços: a placa aparece e depois o conteúdo entra em sequência ---------- */
const placa = document.querySelector('.quadro__placa');
if (placa && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  placa.classList.add('placa--anima');
  placa.querySelectorAll('.quadro__grupo li').forEach((li, i) => li.style.setProperty('--i', i));
  const secao = placa.parentElement; // mede a seção: a placa começa recortada (altura visível zero)
  const checar = () => {
    const r = secao.getBoundingClientRect();
    if (r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2) {
      placa.classList.add('placa--visivel');
      removeEventListener('scroll', checar);
      removeEventListener('resize', checar);
    }
  };
  addEventListener('scroll', checar, { passive: true });
  addEventListener('resize', checar);
  checar();
}

/* ---------- Título do topo: efeito SplitText (adaptado do React Bits com GSAP) ----------
   "Corte na régua, química sem susto." entra letra por letra logo após o pré-loader.
   O gradiente cromado é aplicado em cada letra alinhado à linha, para continuar contínuo. */
(function splitTitulo() {
  const titulo = document.querySelector('.hero__grande');
  if (!titulo || !window.gsap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const linhas = [...titulo.children]; // cada <span> é uma linha
  const original = linhas.map((l) => l.textContent).join(' ');
  linhas.forEach((linha) => {
    linha.setAttribute('aria-hidden', 'true');
    linha.innerHTML = [...linha.textContent]
      .map((ch) => (ch === ' ' ? ' ' : `<span class="letra-hero">${ch}</span>`))
      .join('');
  });
  const leitor = document.createElement('span');
  leitor.className = 'sr';
  leitor.textContent = original; // leitores de tela leem a frase inteira
  titulo.append(leitor);
  titulo.classList.add('hero__grande--split');

  // gradiente cromado contínuo: cada letra recebe o pedaço do gradiente da sua linha
  const pintar = () => {
    linhas.forEach((linha) => {
      const largura = linha.offsetWidth;
      linha.querySelectorAll('.letra-hero').forEach((l) => {
        l.style.backgroundSize = `${largura}px 100%`;
        l.style.backgroundPosition = `${-l.offsetLeft}px 0`;
      });
    });
  };
  const iniciar = () => {
    pintar();
    gsap.fromTo(titulo.querySelectorAll('.letra-hero'),
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.04, delay: 0.85 });
  };
  addEventListener('resize', pintar);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(iniciar);
  gsap.set(titulo.querySelectorAll('.letra-hero'), { opacity: 0 }); // escondidas até a animação começar
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
  fig.addEventListener('mouseenter', () => { escala(ESCALA); legOpac(1); });
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
  fig.addEventListener('mouseleave', () => { rotX(0); rotY(0); escala(1); legOpac(0); legGiro(0); });
})();

/* ---------- Trabalhos da casa (GSAP + ScrollTrigger) ----------
   1) o fundo preto abre do centro (cortinas cinza recolhem para cima e para baixo)
   2) título e texto entram
   3) desktop: linha 1 sobe de baixo p/ cima, da esquerda p/ direita;
      depois a linha 2 desce de cima p/ baixo, da direita p/ esquerda
   Avança conforme a rolagem (scrub) e volta ao subir. Sem GSAP ou com "reduzir movimento",
   a seção aparece normal. */
(function animarTrabalhos() {
  const sec = document.getElementById('trabalhos');
  if (!sec || !window.gsap || !window.ScrollTrigger) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);

  const cima = document.createElement('div');
  const baixo = document.createElement('div');
  cima.className = 'cortina cortina--cima';
  baixo.className = 'cortina cortina--baixo';
  sec.prepend(cima, baixo);

  // quebra o texto em palavras (e letras, no título) com máscara, para ele "se escrever" aos poucos
  const dividir = (el, letras) => {
    const texto = el.textContent.trim();
    el.setAttribute('aria-label', texto);
    el.innerHTML = texto.split(/\s+/).map((palavra) => {
      const miolo = letras
        ? [...palavra].map((ch) => `<span class="letra">${ch}</span>`).join('')
        : palavra;
      return `<span class="pal" aria-hidden="true"><span class="pal__in">${miolo}</span></span>`;
    }).join(' ');
  };
  const titulo = sec.querySelector('.trabalhos__topo h2');
  const texto = sec.querySelector('.trabalhos__topo p');
  dividir(titulo, true);
  dividir(texto, false);
  const letrasTitulo = titulo.querySelectorAll('.letra');
  const palavrasTexto = texto.querySelectorAll('.pal__in');
  const fotos = [...sec.querySelectorAll('.galeria > .foto')];

  gsap.matchMedia().add({ desk: '(min-width: 960px)', mob: '(max-width: 959px)' }, (ctx) => {
    if (!ctx.conditions.desk) {
      // celular: a seção é mais alta que a tela; uma cortina só recolhe para baixo, revelando de cima
      gsap.set(baixo, { display: 'none' });
      gsap.set(cima, { height: '100%', transformOrigin: 'bottom' });
    }
    const topoNav = () => `top ${document.querySelector('[data-nav]')?.offsetHeight || 0}px`;
    // 1ª parte: fundo abre e o texto se escreve enquanto a seção sobe até encostar no menu
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      // presa à rolagem: a animação avança e volta conforme a pessoa rola a página
      scrollTrigger: ctx.conditions.desk
        ? { trigger: sec, start: 'top 90%', end: topoNav, scrub: 1.2 }
        : { trigger: sec, start: 'top 95%', end: 'top 5%', scrub: 1.2 }, // celular: só fundo e texto
    });
    tl.fromTo([cima, baixo], { scaleY: 1 }, { scaleY: 0, duration: 1, ease: 'power2.inOut' })
      .from(letrasTitulo, { yPercent: 110, duration: 0.7, stagger: 0.05 }, '-=0.2')
      .from(palavrasTexto, { yPercent: 110, opacity: 0, duration: 0.6, stagger: 0.05 }, '-=0.3');
    if (ctx.conditions.desk) {
      // 2ª parte (desktop): a seção fica parada na tela e as fotos entram com calma
      // enquanto a pessoa rola, uma a uma. Só depois a página segue.
      const linha1 = fotos.slice(0, 6);
      const linha2 = fotos.slice(6, 12).reverse(); // da direita para a esquerda
      // cada foto surge dentro do próprio quadro (o quadro tem overflow: hidden), como máscara
      const miolo = (linha) => linha.flatMap((f) => [...f.children]);
      const passo = (linha) => (i, el) => linha.indexOf(el.closest('.foto')) * 0.35;
      const altura = (sinal) => (i, el) => sinal * el.closest('.foto').offsetHeight; // desloca a altura do quadro
      gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: { trigger: sec, start: topoNav, end: '+=170%', scrub: 1.2, pin: true, anticipatePin: 1, invalidateOnRefresh: true },
      })
        // fromTo (e não from): com invalidateOnRefresh, o "from" gravaria a posição escondida como final
        .fromTo(miolo(linha1), { y: altura(1) }, { y: 0, duration: 1, stagger: passo(linha1) })
        .fromTo(miolo(linha2), { y: altura(-1) }, { y: 0, duration: 1, stagger: passo(linha2) }, '+=0.2')
        .to({}, { duration: 0.4 }); // respiro: tudo montado antes de soltar a seção
    } else {
      // celular: cada foto tem o próprio gatilho. Começa a surgir quando entra na tela e
      // termina quando o topo dela passa um pouco da metade, acompanhando a rolagem com calma.
      fotos.forEach((foto) => {
        gsap.fromTo([...foto.children], { y: () => foto.offsetHeight * 0.45, opacity: 0 }, {
          y: 0, opacity: 1, ease: 'power2.out',
          scrollTrigger: { trigger: foto, start: 'top 100%', end: 'top 40%', scrub: 1.2, invalidateOnRefresh: true },
        });
      });
    }
  });
})();

/* ---------- Caixas que abrem (química e dúvidas): abrir e fechar deslizando ---------- */
document.querySelectorAll('.quadro__glossario, .duvidas details').forEach((det) => {
  const resumo = det.querySelector('summary');
  const caixa = document.createElement('div');
  caixa.className = 'det__conteudo';
  [...det.children].filter((c) => c !== resumo).forEach((c) => caixa.append(c));
  det.append(caixa);
  if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let animando = false;
  resumo.addEventListener('click', (e) => {
    e.preventDefault();
    if (animando) return;
    animando = true;
    if (!det.open) {
      det.open = true;
      gsap.fromTo(caixa, { height: 0, opacity: 0 }, {
        height: 'auto', opacity: 1, duration: 0.5, ease: 'power3.out',
        onComplete: () => { gsap.set(caixa, { clearProps: 'height' }); animando = false; },
      });
      const itens = caixa.querySelectorAll('dl > div');
      if (itens.length) gsap.from(itens, { y: 14, opacity: 0, duration: 0.45, stagger: 0.07, delay: 0.1, ease: 'power3.out' });
    } else {
      gsap.to(caixa, {
        height: 0, opacity: 0, duration: 0.35, ease: 'power3.in',
        onComplete: () => { det.open = false; gsap.set(caixa, { clearProps: 'all' }); animando = false; },
      });
    }
  });
});

/* ---------- Dúvidas: as perguntas entram uma de cada vez, da direita para a esquerda ----------
   Na ordem da lista, quando a seção chega na tela. Ao voltar para cima, saem e entram de novo. */
(function animarDuvidas() {
  const perguntas = document.querySelectorAll('.duvidas details');
  if (!perguntas.length || !window.gsap || !window.ScrollTrigger) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.fromTo(perguntas, { x: 120, opacity: 0 }, {
    x: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.18,
    clearProps: 'transform', // sem transform depois de pronta: não atrapalha o abrir e fechar
    scrollTrigger: { trigger: '.duvidas__lista', start: 'top 80%', toggleActions: 'play none none reverse' },
  });
})();

/* ---------- Foto ampliada ---------- */
const dialogo = document.querySelector('[data-ampliada]');
if (dialogo && typeof dialogo.showModal === 'function') {
  const img = dialogo.querySelector('img');
  document.querySelectorAll('[data-ampliar]').forEach((b) => b.addEventListener('click', () => {
    img.src = b.dataset.ampliar;
    img.alt = b.querySelector('img').alt;
    dialogo.showModal();
  }));
  dialogo.querySelector('[data-fechar]').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
} else {
  // navegador sem <dialog>: abre a foto grande direto
  document.querySelectorAll('[data-ampliar]').forEach((b) => b.addEventListener('click', () => { location.href = b.dataset.ampliar; }));
}

/* ---------- Simulador: Monte sua visita ----------
   Soma os serviços marcados e continua no agendamento (passo 2) com eles já escolhidos. */
const form = document.querySelector('[data-simulador]');
if (form) {
  const chips = form.querySelector('[data-chips]');
  chips.innerHTML = SERVICOS.map((s, i) =>
    `<label><input type="checkbox" name="servico" value="${i}"><span>${s.nome} <small>${brl(s.preco)}</small></span></label>`
  ).join('');

  const enviar = form.querySelector('[data-enviar]');
  const enviarTexto = form.querySelector('[data-enviar-texto]');
  const totalPreco = form.querySelector('[data-total-preco]');
  const totalTempo = form.querySelector('[data-total-tempo]');

  function atualizar() {
    const marcados = [...form.querySelectorAll('input[name="servico"]:checked')].map((c) => SERVICOS[Number(c.value)]);
    totalPreco.textContent = brl(marcados.reduce((t, s) => t + s.preco, 0));
    totalTempo.textContent = duracao(marcados.reduce((t, s) => t + s.min, 0));
    enviar.disabled = !marcados.length;
    enviar.dataset.agenda = marcados.map((s) => s.nome).join('|');
    enviarTexto.textContent = marcados.length ? 'Escolher dia e horário' : 'Escolha pelo menos um serviço';
  }
  form.addEventListener('change', atualizar);
  form.addEventListener('submit', (e) => e.preventDefault());
  atualizar();
}

/* ---------- Agendamento: tela em 4 passos (serviço, profissional, data e hora, confirmar) ----------
   Abre por cima da página em qualquer "Agendar" ([data-agenda], cartões, tabela e "Quero esse").
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

  // telefone com máscara: (11) 91234-5678
  const tel = form.elements.telefone;
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    tel.value = d.length > 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  function valido(p) {
    if (p === 1) return marcados().length > 0;
    if (p === 2) return Boolean(valor('profissional'));
    if (p === 3) return Boolean(diaSel && valor('hora'));
    if (p === 4) return form.elements.nome.value.trim().length >= 2 && tel.value.replace(/\D/g, '').length >= 10;
    return true;
  }

  function atualizar() {
    const lista = marcados();
    total.innerHTML = lista.length
      ? `<strong>${brl(lista.reduce((t, s) => t + s.preco, 0))}</strong><span>${duracao(duracaoTotal())}${lista.length > 1 ? ` · ${lista.length} serviços` : ''}</span>`
      : '<span>Nenhum serviço escolhido</span>';
    btAvancar.disabled = enviando || !valido(passo);
  }

  function irPara(n) {
    passo = n;
    etapas.forEach((e) => { e.hidden = Number(e.dataset.etapa) !== n; });
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
    corpo.scrollTop = 0;
    const atual = etapas.find((e) => !e.hidden);
    atual.querySelector('.etapa__titulo')?.focus({ preventScroll: true });
    entrar(atual, n);
    atualizar();
  }

  // entrada de cada passo; no "Confirmar" cada linha do resumo aparece uma de cada vez
  function entrar(secao, n) {
    if (!animar) return;
    if (n === 4) {
      const itens = [secao.querySelector('.etapa__titulo'), ...secao.querySelectorAll('[data-revela]')];
      gsap.fromTo(itens, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.12, overwrite: true });
      gsap.fromTo(btAvancar, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: itens.length * 0.12, overwrite: true });
    } else if (n === 5) {
      gsap.fromTo([...secao.children], { y: 20, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out', stagger: 0.12, overwrite: true });
    } else {
      gsap.set(btAvancar, { clearProps: 'all' });
      gsap.fromTo(secao, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
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
    dialogo.showModal();
    document.documentElement.classList.add('agenda-aberta');
    irPara(pular && marcados().length ? 2 : 1);
  }
  const fechar = () => dialogo.close();

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
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) fechar(); }); // clique fora
  dialogo.addEventListener('close', () => document.documentElement.classList.remove('agenda-aberta'));

  // qualquer botão de agendar do site abre esta tela (com o serviço já marcado quando houver)
  document.addEventListener('click', (e) => {
    const gatilho = e.target.closest('[data-agenda], [data-agendar], [data-servico], [data-quero]');
    if (!gatilho || dialogo.contains(gatilho)) return;
    e.preventDefault();
    const lista = gatilho.dataset.servicos || gatilho.dataset.agendar || gatilho.dataset.servico || gatilho.dataset.agenda || '';
    abrir(lista.split('|').filter(Boolean), 'agendaPular' in gatilho.dataset);
  });
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

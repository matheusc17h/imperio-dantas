/* =====================================================================
   IMPÉRIO DANTAS · interações
   Para editar dados: CONFIG e HORARIOS logo abaixo.
   Os preços ficam no index.html (tabela de preços e JSON-LD).
   ===================================================================== */

const CONFIG = {
  whatsapp: '5511945046553',
  // endereço usado no mapa e no "Abrir no Google Maps"
  endereco: 'Estrada do Pequiá, 1828 - Vila Silviania, Carapicuíba - SP, 06381-095',
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
const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR');
const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hora = (hhmm) => hhmm.replace(':00', 'h').replace(':', 'h');
const preenchido = (txt) => txt && !txt.includes('[');

/* ---------- WhatsApp: um lugar só para montar os links ---------- */
function linkWhatsApp(mensagem) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

document.querySelectorAll('[data-wa]').forEach((a) => { a.href = linkWhatsApp(a.dataset.wa); });
document.querySelectorAll('[data-agendar]').forEach((a) => {
  a.href = linkWhatsApp(`Olá! Quero agendar ${a.dataset.agendar}. Qual o melhor horário?`);
});
document.querySelectorAll('[data-servico]').forEach((a) => {
  const { servico, preco, min } = a.dataset;
  a.href = linkWhatsApp(`Olá! Quero agendar ${servico} (${brl(Number(preco))}, ${min} min). Qual o melhor horário?`);
  a.setAttribute('aria-label', `Agendar ${servico}, ${brl(Number(preco))}, ${min} minutos`);
});
document.querySelectorAll('[data-quero]').forEach((a) => {
  a.href = linkWhatsApp(`Olá! Vi o trabalho "${a.dataset.quero}" no site e quero agendar algo parecido.`);
  a.setAttribute('aria-label', `Quero esse: ${a.dataset.quero}, agendar pelo WhatsApp`);
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
    if (r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.2) {
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
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.04, delay: 1.85 });
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
   Roda ao descer até a seção e desfaz ao subir. Sem GSAP ou com "reduzir movimento",
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
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: sec, start: 'top 65%', toggleActions: 'play none none reverse' },
    });
    tl.fromTo([cima, baixo], { scaleY: 1 }, { scaleY: 0, duration: 0.8, ease: 'power3.inOut' })
      .from(letrasTitulo, { yPercent: 110, duration: 0.55, stagger: 0.035 }, '-=0.3')
      .from(palavrasTexto, { yPercent: 110, opacity: 0, duration: 0.45, stagger: 0.03 }, '-=0.35');
    if (ctx.conditions.desk) {
      const linha1 = fotos.slice(0, 6);
      const linha2 = fotos.slice(6, 12).reverse(); // da direita para a esquerda
      // cada foto surge dentro do próprio quadro (o quadro tem overflow: hidden), como máscara
      const miolo = (linha) => linha.flatMap((f) => [...f.children]);
      const passo = (linha) => (i, el) => linha.indexOf(el.closest('.foto')) * 0.09;
      const altura = (sinal) => (i, el) => sinal * el.closest('.foto').offsetHeight; // desloca a altura do quadro
      tl.from(miolo(linha1), { y: altura(1), duration: 0.8, stagger: passo(linha1) }, '-=0.25')
        .from(miolo(linha2), { y: altura(-1), duration: 0.8, stagger: passo(linha2) });
    } else {
      tl.from(fotos, { y: 80, opacity: 0, duration: 0.6, stagger: 0.06 }, '-=0.25');
    }
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

/* ---------- Simulador: Monte sua visita ---------- */
const form = document.querySelector('[data-simulador]');
if (form) {
  // a lista de serviços vem da tabela de preços (fonte única)
  const servicos = [...document.querySelectorAll('[data-servico]')].map((a) => ({
    nome: a.dataset.servico, preco: Number(a.dataset.preco), min: Number(a.dataset.min),
  }));
  const chips = form.querySelector('[data-chips]');
  chips.innerHTML = servicos.map((s, i) =>
    `<label><input type="checkbox" name="servico" value="${i}"><span>${s.nome} <small>${brl(s.preco)}</small></span></label>`
  ).join('');

  // próximos dias abertos (pula segunda e dias fechados)
  const selDia = form.querySelector('[data-dia]');
  const { dia: hojeDia, min: agoraMin } = agoraSP();
  const opcoes = [];
  for (let i = 0; opcoes.length < 8 && i < 14; i++) {
    const d = (hojeDia + i) % 7;
    const h = HORARIOS[d];
    if (!h) continue;
    if (i === 0 && agoraMin >= minutos(h[1]) - 30) continue; // hoje já está fechando
    const data = new Date(Date.now() + i * 864e5);
    const rotulo = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIAS[d][0].toUpperCase() + DIAS[d].slice(1);
    const dataTxt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
    opcoes.push(`<option value="${d}" data-texto="${i < 2 ? rotulo.toLowerCase() : DIAS[d]} (${dataTxt})">${rotulo}, ${dataTxt}</option>`);
  }
  selDia.innerHTML = opcoes.join('');

  // períodos: manhã até 12h, tarde até 18h, noite até o fechamento
  const periodos = form.querySelectorAll('input[name="periodo"]');
  const limites = { 'de manhã': [0, 720], 'à tarde': [720, 1080], 'à noite': [1080, 1440] };
  function ajustarPeriodos() {
    const d = Number(selDia.value);
    const h = HORARIOS[d];
    if (!h) return;
    const ehHoje = d === hojeDia && selDia.selectedIndex === 0;
    periodos.forEach((p) => {
      const [ini, fim] = limites[p.value];
      const abre = minutos(h[0]); const fecha = minutos(h[1]);
      let ok = fecha > ini && abre < fim;
      if (ok && ehHoje) ok = agoraMin < Math.min(fim, fecha) - 30;
      p.disabled = !ok;
    });
    if ([...periodos].find((p) => p.checked)?.disabled) {
      const livre = [...periodos].find((p) => !p.disabled);
      if (livre) livre.checked = true;
    }
  }

  const enviar = form.querySelector('[data-enviar]');
  const enviarTexto = form.querySelector('[data-enviar-texto]');
  const totalPreco = form.querySelector('[data-total-preco]');
  const totalTempo = form.querySelector('[data-total-tempo]');

  function atualizar() {
    ajustarPeriodos();
    const marcados = [...form.querySelectorAll('input[name="servico"]:checked')].map((c) => servicos[Number(c.value)]);
    const preco = marcados.reduce((t, s) => t + s.preco, 0);
    const tempo = marcados.reduce((t, s) => t + s.min, 0);
    totalPreco.textContent = brl(preco);
    totalTempo.textContent = tempo >= 60 ? `${Math.floor(tempo / 60)}h${tempo % 60 ? String(tempo % 60).padStart(2, '0') : ''}` : `${tempo} min`;

    if (!marcados.length) {
      enviar.setAttribute('aria-disabled', 'true');
      enviarTexto.textContent = 'Escolha pelo menos um serviço';
      return;
    }
    const periodo = [...periodos].find((p) => p.checked && !p.disabled);
    const quando = `${selDia.selectedOptions[0]?.dataset.texto || ''}${periodo ? ', ' + periodo.value : ''}`;
    const lista = marcados.map((s) => s.nome).join(' + ');
    const msg = `Olá! Quero agendar: ${lista} (${brl(preco)}, ${tempo} min), ${quando}. Tem horário?`;
    enviar.href = linkWhatsApp(msg);
    enviar.removeAttribute('aria-disabled');
    enviarTexto.textContent = `Agendar ${marcados.length > 1 ? marcados.length + ' serviços' : marcados[0].nome} no WhatsApp`;
  }
  form.addEventListener('change', atualizar);
  form.addEventListener('submit', (e) => e.preventDefault());
  atualizar();
}

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

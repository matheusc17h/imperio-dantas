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

/* ---------- Mapa: só carrega quando o endereço estiver preenchido e a seção aparecer ---------- */
const mapa = document.querySelector('[data-mapa]');
const comoChegar = document.querySelector('[data-como-chegar]');
if (preenchido(CONFIG.endereco)) {
  const q = encodeURIComponent(CONFIG.endereco);
  if (comoChegar) comoChegar.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  if (mapa && 'IntersectionObserver' in window) {
    new IntersectionObserver((entradas, obs) => {
      if (!entradas[0].isIntersecting) return;
      mapa.innerHTML = `<iframe title="Mapa do Império Dantas" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe>`;
      obs.disconnect();
    }, { rootMargin: '300px' }).observe(mapa);
  }
}

/* ---------- Analytics: cliques de WhatsApp (liga no GA4 quando tiver) ---------- */
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-evento]');
  if (alvo && typeof window.gtag === 'function') window.gtag('event', 'clique_whatsapp', { local: alvo.dataset.evento });
});

/* ---------- Ano no rodapé ---------- */
document.querySelectorAll('[data-ano]').forEach((el) => { el.textContent = new Date().getFullYear(); });

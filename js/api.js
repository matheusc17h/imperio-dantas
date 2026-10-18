/* =====================================================================
   IMPÉRIO DANTAS · camada de dados
   A interface (js/main.js) só fala com o servidor por aqui. Hoje a FILA é simulada: dados de
   mentira guardados neste navegador, só para testar a tela. Para ligar no servidor, troque o
   corpo de cada função por um fetch (ex.: GET/POST/DELETE em /api/fila), mantendo os mesmos
   nomes, parâmetros e formatos de retorno.

   Uma pessoa na fila (getQueue, getMyTicket, joinQueue):
     { ticketId: 'f_9b2c…', nomeExibicao: 'Lucas S.', posicao: 1,
       servico: 'Corte degradê' | null, entrouEm: '2026-10-18T14:05:00.000Z' }
   O WhatsApp de quem entra NUNCA volta nas respostas: só o servidor guarda.
   ===================================================================== */
(function () {
  const REDE = 250;                 // simula a demora da rede (ms)
  const PASSO = 30 * 1000;          // a fila anda uma posição a cada 30s (simulação)
  const MAXIMO = 7;                 // a simulação não deixa a fila crescer sem fim
  const CHAVE = 'id-fila-simulada'; // só a simulação usa; sai quando ligar o servidor
  const NOMES = ['Lucas S.', 'Rafael M.', 'Bruno A.', 'Diego P.', 'Thiago R.', 'Mateus C.', 'Gustavo L.', 'Kauã F.', 'Ana B.', 'Júlia T.'];
  const SERVICOS = ['Corte degradê', 'Corte social', 'Corte navalhado', 'Barba', 'Luzes', null];

  const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const novoId = () => 'f_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const responder = (valor) => new Promise((ok) => setTimeout(() => ok(valor), REDE));

  // "Matheus da Silva" -> "Matheus S." (o servidor faz isso; a lista pública nunca mostra o nome inteiro)
  function nomeExibicao(nome) {
    const partes = nome.trim().split(/\s+/);
    const primeiro = partes[0][0].toLocaleUpperCase('pt-BR') + partes[0].slice(1).toLocaleLowerCase('pt-BR');
    return partes.length > 1 ? `${primeiro} ${partes[partes.length - 1][0].toLocaleUpperCase('pt-BR')}.` : primeiro;
  }

  const ficticia = (quando) => ({
    ticketId: novoId(), nomeExibicao: sorteio(NOMES), servico: sorteio(SERVICOS), entrouEm: new Date(quando).toISOString(), ficticia: true,
  });
  function filaNova(agora) {
    const n = 3 + Math.floor(Math.random() * 3); // 3 a 5 pessoas
    return { andouEm: agora, pessoas: Array.from({ length: n }, (_, i) => ficticia(agora - (n - i) * 7 * 60 * 1000)) };
  }

  let memoria = null; // reserva para navegador que bloqueia o localStorage
  function ler() {
    try { const txt = localStorage.getItem(CHAVE); if (txt) return JSON.parse(txt); } catch { /* usa a memória */ }
    return memoria;
  }
  function gravar(estado) {
    memoria = estado;
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* fica só na memória */ }
  }

  // lê a fila e faz ela andar de acordo com o tempo que passou desde a última vez
  function estado() {
    const agora = Date.now();
    let e = ler();
    if (!e || agora - e.andouEm > 20 * PASSO) e = filaNova(agora); // muito tempo parada: recomeça
    while (agora - e.andouEm >= PASSO) {
      e.andouEm += PASSO;
      // quem está na frente é atendido. A pessoa de verdade fica parada em 1º, para testar o aviso de "próximo"
      if (e.pessoas[0]?.ficticia) e.pessoas.shift();
      if (e.pessoas.length < MAXIMO && (Math.random() < 0.5 || e.pessoas.length < 2)) e.pessoas.push(ficticia(e.andouEm));
    }
    gravar(e);
    return e;
  }

  const publico = (p, i) => ({ ticketId: p.ticketId, nomeExibicao: p.nomeExibicao, posicao: i + 1, servico: p.servico, entrouEm: p.entrouEm });

  /** Fila de agora, em ordem. Sem WhatsApp nem nome completo. */
  async function getQueue() {
    return responder(estado().pessoas.map(publico));
  }

  /** Posição de um ticket, ou null se ele não está mais na fila (foi atendido ou saiu). */
  async function getMyTicket(ticketId) {
    const e = estado();
    const i = e.pessoas.findIndex((p) => p.ticketId === ticketId);
    return responder(i < 0 ? null : publico(e.pessoas[i], i));
  }

  /** Entra no fim da fila. Devolve o ticket. Erro com mensagem pronta para mostrar. */
  async function joinQueue({ nome, whatsapp, servico } = {}) {
    const n = String(nome || '').trim();
    const numero = String(whatsapp || '').replace(/\D/g, '');
    if (n.length < 2) throw new Error('Escreva seu nome.');
    if (!/^\d{2}9\d{8}$/.test(numero)) throw new Error('Confira o WhatsApp: DDD + número de celular.');
    const e = estado();
    // o servidor guardaria o WhatsApp (para avisar e para recusar o mesmo número duas vezes); a simulação descarta
    const p = { ticketId: novoId(), nomeExibicao: nomeExibicao(n), servico: servico || null, entrouEm: new Date().toISOString() };
    e.pessoas.push(p);
    gravar(e);
    return responder(publico(p, e.pessoas.length - 1));
  }

  /** Sai da fila. */
  async function leaveQueue(ticketId) {
    const e = estado();
    e.pessoas = e.pessoas.filter((p) => p.ticketId !== ticketId);
    gravar(e);
    return responder({ ok: true });
  }

  window.api = { getQueue, joinQueue, leaveQueue, getMyTicket };
})();

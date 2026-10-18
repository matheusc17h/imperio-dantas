/* Pré-loader só na primeira visita da sessão (fechou a aba, vê de novo). Roda antes de a página aparecer (sem defer) para a
   abertura não piscar em quem já viu. Fica num arquivo à parte porque o CSP bloqueia script inline. */
try {
  if (sessionStorage.getItem('id-intro-vista')) document.documentElement.classList.add('sem-intro');
  else sessionStorage.setItem('id-intro-vista', '1');
} catch (e) { /* sem sessionStorage (armazenamento bloqueado): mostra a abertura normalmente */ }

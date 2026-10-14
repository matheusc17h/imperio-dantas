# PROMPT — Site Império Dantas (Salão de Beleza Unissex)

> **Pasta do projeto:** `C:\Users\mcava\OneDrive\Desktop\dantas-imperio`
> - Imagens: `C:\Users\mcava\OneDrive\Desktop\dantas-imperio\img`
> - Referência de SEO: `C:\Users\mcava\OneDrive\Desktop\dantas-imperio\Dantas-Imperio-Referencias-e-SEO.pdf`
>   (leia antes de começar e siga-o)
> - Crie todos os arquivos do site **dentro desta pasta**.

---

## 0. Papel e objetivo

Você é um designer e desenvolvedor front-end sênior, especialista em sites de alto padrão para negócios locais.
Construa o site one-page do **Império Dantas — Salão de Beleza Unissex**, com três metas, nesta ordem:

1. **Conversão:** levar o visitante a agendar pelo WhatsApp com o menor número de toques possível.
2. **SEO local:** aparecer em "barbearia/salão em [bairro]", nos serviços específicos e nas respostas de IA do Google.
3. **Alto padrão sem nada genérico:** cada escolha visual tem que nascer da logo e das fotos reais da casa.
   Se um elemento poderia estar no site de qualquer outra barbearia, refaça.

Eu vou editar o site depois, do meu jeito. Por isso o código precisa ser **limpo, comentado por seção e fácil de mexer**.

---

## 1. Dados fixos — NÃO ALTERAR

Use exatamente estes dados. Não arredonde, não renomeie, não crie promoção, desconto, combo nem preço novo.

### Horário de funcionamento
| Dia | Horário |
|---|---|
| Domingo | 09h às 15h |
| Segunda | Fechado |
| Terça | 09h às 20h |
| Quarta | 09h às 20h |
| Quinta | 09h às 20h |
| Sexta | 09h às 20h |
| Sábado | 09h às 20h |

Segunda-feira é **fechado**. Deixe o horário num objeto de configuração no topo do JS (`HORARIOS`), com a segunda como `null`
(fechado), para eu ajustar depois. No simulador de agendamento, a segunda fica desabilitada.

### Tabela de serviços
| Serviço | Preço | Duração |
|---|---|---|
| Corte social | R$ 30 | 30 min |
| Corte degradê | R$ 35 | 35 min |
| Corte navalhado | R$ 40 | 40 min |
| Relaxamento | R$ 30 | 20 min |
| Progressiva | R$ 85 | 40 min |
| Botox | R$ 70 | 40 min |
| Luzes | R$ 100 | 60 min |
| Nevou | R$ 130 | 60 min |
| Barba | R$ 25 | 25 min |
| Limpeza de pele | R$ 15 | 20 min |
| Limpeza completa | R$ 30 | 30 min |
| Penteados | R$ 30 | 25 min |

Guarde os serviços num único array `SERVICOS` no JS (ou em um JSON), que alimenta os cards, o simulador e o schema.
Assim cada preço é editado num lugar só.

### Contato
- **WhatsApp / telefone:** +55 11 94504-6553
  - Link: `https://wa.me/5511945046553`
  - Exibição no site: (11) 94504-6553
  - Schema: `"telephone": "+55-11-94504-6553"`

### Dados que ainda não tenho (usar placeholders visíveis e fáceis de achar)
`[ENDERECO COMPLETO]` · `[BAIRRO]` · `[CIDADE]` · `[UF]` · `[INSTAGRAM]` · `[DOMINIO]` · `[LINK GOOGLE MAPS]`
Junte todos num objeto `CONFIG` no topo do JS e repita-os no `<head>` (meta/schema) com comentário `<!-- PREENCHER -->`.

---

## 2. Arquivos disponíveis em `img/`

- `logo.jpeg`: logo oficial (coroa, "IMPÉRIO DANTAS", navalha, "Salão de Beleza Unissex"). Fundo preto, arte branca/prateada.
- `salao.jpeg`: foto do salão. **Vai no header/hero.** Atenção: a foto está **inclinada (~30°)** e mostra a rua, uma caçamba
  e um poste no canto superior esquerdo. Endireite, recorte para mostrar só o interior (cadeiras, espelhos redondos,
  ripado amadeirado, plantas) e escureça com overlay para o texto ficar legível. Se o recorte ficar pequeno demais, me avise.
- `WhatsApp Image ... .jpeg` (13 fotos): **cortes e trabalhos reais da casa.** São o portfólio dos cards.
  Renomeie para `corte-01.webp`, `corte-02.webp`… (sem espaços), exporte em WebP (qualidade ~75, máx. 1200px no lado maior)
  e gere versão menor para os cards (~600px).
- `layout.png`: **referência de layout. Siga essa estrutura** (seção 4).

Não use nenhuma foto de banco de imagem, ilustração genérica ou pessoa gerada por IA. Só fotos reais da casa.
(Opcional, se eu pedir: usar o MCP do Higgsfield apenas para **melhorar a nitidez/upscale** das fotos reais. Nunca para inventar corte ou cliente.)

---

## 3. Identidade visual (tirada da logo)

A logo é **monocromática: preto profundo, branco e prata cromado**, com serifa clássica de inscrição romana em caixa alta
e espaçamento largo. Isso é o diferencial: quase toda barbearia "premium" usa preto e dourado. Nós vamos de **preto e prata**.

- **Cores** (defina como variáveis CSS):
  - `--preto: #0B0B0C` (fundo principal)
  - `--carvao: #16161A` (superfícies, cards)
  - `--grafite: #2A2A2F` (bordas, divisores)
  - `--prata: #C9CCD1` (destaques, ícones, linhas finas)
  - `--cromo: linear-gradient(...)` de `#F4F5F7` → `#9DA1A8` → `#E6E7EA`, usado **só** em detalhes pequenos
    (linha sob títulos, borda do botão principal, coroa), imitando o metal da navalha da logo
  - `--marfim: #F2F0EC` (texto principal e seções claras)
  - `--cinza-texto: #9A9AA2` (texto secundário)
  - Nada de dourado, roxo, azul ou gradiente colorido.
- **Tipografia:**
  - Títulos e logo-type: serifa de inscrição romana em caixa alta com letter-spacing largo (ex.: **Cinzel** ou **Cormorant SC**)
    para conversar com "IMPÉRIO DANTAS" da logo.
  - Títulos grandes de impacto: **Cormorant Garamond** (peso 500–600), com itálico em uma palavra-chave por título.
  - Texto e interface: uma sans limpa e com personalidade (ex.: **Manrope** ou **Jost**). **Não usar Inter, Roboto nem Poppins.**
  - Carregar no máximo 2–3 famílias, com `font-display: swap` e `preconnect`.
- **Elementos de assinatura** (o que faz o site ser só nosso):
  - Filetes finos prateados com o losango/flor-de-lis da base da logo como divisor de seção ( ── ◆ ── ).
  - Rótulos de seção em caixa alta espaçada, como "SALÃO DE BELEZA ─ UNISSEX" na logo.
  - Numeração romana discreta nas categorias de serviço (I. Cortes, II. Química, III. Barba, IV. Pele & Estilo).
  - A coroa da logo como marca d'água sutil em uma única seção, não espalhada pelo site.
- **Raios e sombras:** cantos retos ou raio mínimo (2–4px). Sem sombras borradas genéricas. Profundidade com bordas de 1px prata.

---

## 4. Layout — seguir a estrutura de `layout.png`, seção por seção

Mantenha a **mesma estrutura e hierarquia** da referência, trocando conteúdo, cores e tipografia pelos nossos:

1. **Barra superior fina** (faixa no topo)
   Na referência é uma promoção. **Aqui não inventamos promoção.** Use o status real:
   "● Aberto agora · fecha às 20h" / "Fechado · abre domingo às 09h", calculado pelo horário, + "Agende pelo WhatsApp →".

2. **Navegação:** logo à esquerda (versão horizontal ou a coroa + "IMPÉRIO DANTAS"), links centralizados
   (Início · Serviços · Trabalhos · Sobre · Contato) e botão sólido **"Agendar horário"** à direita.
   No celular: hambúrguer + botão de agendar sempre visível.

3. **Hero (dividido como na referência):**
   - Esquerda: rótulo pequeno em caixa alta → título grande em serifa (2 linhas, uma palavra em itálico) → subtítulo curto
     → dois botões: **"Agendar pelo WhatsApp"** (principal) e **"Ver serviços e preços"** (secundário).
     Abaixo: prova social (nota do Google + nº de avaliações, como placeholder `[NOTA]` e `[Nº AVALIAÇÕES]`; **não invente números**).
   - Direita: **a foto do salão (`salao.jpeg`)**, tratada como na seção 2, ocupando a altura do hero.
   - O H1 deve conter o serviço e o local para o SEO, por exemplo
     "Salão unissex e barbearia em [BAIRRO]" como H1 visível ou rótulo, com o título de impacto ao lado.

4. **Faixa de diferenciais (4 itens com ícone, como na referência):** use só fatos verdadeiros:
   - Salão unissex: corte, química, barba e pele
   - Aberto aos domingos (09h às 15h)
   - Agendamento rápido pelo WhatsApp
   - Preço e tempo de cada serviço à vista
   Ícones de traço fino prateado, desenhados em SVG no estilo da logo. Nada de pacote de ícone genérico com cara de template.

5. **Serviços ("Precisão em cada detalhe"):** título à esquerda + cards à direita, como na referência.
   - Cards com **foto real** (dos trabalhos), nome do serviço, **preço e duração** e botão "Agendar".
   - Organizar por categoria com abas: **I. Cortes** (social, degradê, navalhado) · **II. Química** (relaxamento, progressiva,
     botox, luzes, nevou) · **III. Barba** · **IV. Pele & Estilo** (limpeza de pele, limpeza completa, penteados).
   - Cada serviço com 1 frase explicando o que é e para quem é (ex.: o que é "nevou"), para converter quem não conhece.
   - Carrossel com setas no desktop e rolagem com snap no celular.

6. **Portfólio — "Trabalhos da casa" (cards dos cortes):** grade/carrossel com as 13 fotos reais.
   - Cada card: foto, legenda curta com o tipo de trabalho e botão **"Quero esse"**, que abre o WhatsApp com a mensagem
     "Olá! Vi esse trabalho no site e quero agendar algo parecido." + nome do serviço.
   - Ao tocar, abre em tela cheia (lightbox leve, acessível, fecha com ESC/deslizar).
   - Não identifique o tipo de corte se não tiver certeza: use legenda genérica editável (`[legenda]`) e deixe comentado.

7. **Bloco dividido "Agende seu horário" (como "Book Your Appointment Today" da referência):**
   - Esquerda: foto do interior (segundo recorte de `salao.jpeg` ou foto do trabalho na cadeira) com frase de marca curta.
   - Direita: **simulador de visita**: o cliente marca um ou mais serviços, escolhe o dia e o período (manhã/tarde/noite);
     o site soma **preço total e tempo total** e o botão gera o link `wa.me` com a mensagem pronta:
     "Olá! Quero agendar: Corte degradê + Barba (R$ 60 · 60 min), sábado à tarde."
     Dias fora do horário ficam desabilitados.

8. **Horário e localização:** tabela de horário com o dia atual destacado, mapa do Google incorporado com carregamento tardio
   (só carrega quando aparece na tela) e botão "Como chegar".

9. **FAQ** (com `<details>` acessível e schema FAQPage): "Precisa agendar?", "Atende cabelo feminino?" (é unissex),
   "Quanto tempo dura a progressiva?", "O que é o nevou?", "Abre domingo?". Respostas curtas e diretas, com base só nos dados acima.
   Formas de pagamento ficam como `[PREENCHER]`.

10. **Rodapé** (como a referência, sem newsletter): logo, endereço, horário, WhatsApp, Instagram, mapa do site
    e "© Império Dantas".

11. **Barra fixa no celular** (sempre visível na parte de baixo): **"Agendar no WhatsApp"** (principal, com o ícone do WhatsApp) + "Como chegar".

12. **Ícone flutuante do WhatsApp** (desktop e tablet):
    - Botão redondo fixo no canto inferior direito (~60px). Ao clicar, abre `https://wa.me/5511945046553` com a mensagem
      "Olá! Vim pelo site e quero agendar um horário." via `linkWhatsApp()`, em nova aba.
    - **Ícone oficial do WhatsApp** em SVG inline (não usar emoji nem imagem pixelada), na **cor verde oficial `#25D366`**.
      É a única exceção à paleta, porque o reconhecimento imediato converte. Fundo `--preto` com borda de 1px em cromo prata,
      para combinar com a logo.
    - Ao passar o mouse, aparece um rótulo curto "Agendar no WhatsApp" ao lado. Pulso sutil só uma vez, ao carregar
      (respeitar `prefers-reduced-motion`). Nada de balão de chat, contador ou mensagem automática.
    - `aria-label="Agendar pelo WhatsApp"`, foco visível, `data-evento="whatsapp-flutuante"`.
    - **No celular**, o ícone fica dentro do botão principal da barra fixa (item 11), em vez de flutuar.
      Assim não aparecem dois botões iguais e nada cobre o conteúdo. Respeitar `env(safe-area-inset-bottom)`.
    - O mesmo ícone SVG aparece em todos os botões de WhatsApp do site (hero, cards, simulador, rodapé).

---

## 5. Conversão (obrigatório)

- Agendar em **até 3 toques** a partir de qualquer ponto da página. Sem cadastro, sem login, sem formulário longo.
- Todos os links de WhatsApp gerados por uma única função `linkWhatsApp(mensagem)` que usa `CONFIG.whatsapp`.
- Preço + duração visíveis em todos os cards. Nunca "consulte".
- Prova social perto dos botões: espaço para 2 ou 3 avaliações reais do Google (placeholders comentados).
  **Proibido inventar depoimentos, nomes ou notas.**
- Textos curtos, diretos e em português do Brasil, sem clichês ("excelência", "qualidade incomparável", "experiência única").
  Fale do resultado: o corte alinhado, a química que dura, o horário que cabe na rotina.
- Nada de urgência falsa, contador regressivo ou pop-up.
- Eventos de clique nos botões de WhatsApp com `data-evento="whatsapp-hero"` etc., prontos para eu ligar no Google Analytics depois.

---

## 6. SEO (seguir o PDF `Dantas-Imperio-Referencias-e-SEO.pdf`)

- `<title>`: "Império Dantas | Salão Unissex e Barbearia em [BAIRRO], [CIDADE]", com no máximo ~60 caracteres.
- `meta description` com serviços, local e "aberto aos domingos" (~150 caracteres).
- Um único H1. Hierarquia H2/H3 correta. Os nomes de serviço aparecem como texto real, não dentro de imagem.
- **JSON-LD `HairSalon`** com nome, logo, imagem, telefone, endereço, `geo` (placeholder), `openingHoursSpecification`
  **exatamente** como na seção 1, `priceRange: "R$ 15 - R$ 130"`, `sameAs` (Instagram) e `hasOfferCatalog` com **os 12 serviços**
  e preços gerados do array `SERVICOS`. Inclua também o JSON-LD de **FAQPage**.
- Open Graph e Twitter Card com a foto do salão (1200×630).
- `alt` descritivo em todas as fotos (ex.: "Corte degradê com risca feito no Império Dantas, [BAIRRO]").
  Nome de arquivo descritivo.
- `sitemap.xml`, `robots.txt`, `favicon` (coroa da logo em SVG/PNG), `lang="pt-BR"`, URL canônica.
- Deixe a estrutura pronta para crescer para **uma página por serviço** (`/servicos/corte-degrade/`, `/servicos/nevou/`…),
  com o mesmo cabeçalho/rodapé. Na primeira versão basta a one-page com âncoras e IDs por serviço.
- NAP (nome, endereço, telefone) idêntico em todo o site e igual ao Perfil da Empresa no Google.

---

## 7. Performance, responsividade e iPhone

- Metas do Core Web Vitals: **LCP < 2,5s, INP < 200ms, CLS < 0,1** no celular.
- Stack simples para eu editar: **HTML + CSS + JavaScript puro** (sem framework), em `index.html`, `css/style.css` e `js/main.js`.
- Imagem do hero com `fetchpriority="high"` e `<picture>` em WebP com tamanhos responsivos.
  Todas as outras com `loading="lazy"`, `width` e `height`.
- Mobile-first, de 360px a 1440px+, sem rolagem horizontal. Toque mínimo de 44px.
- Cuidados com iOS/Safari: usar `100svh`/`dvh` no hero, `env(safe-area-inset-bottom)` na barra fixa, sem `background-attachment: fixed`,
  e menu e lightbox sem travar a rolagem.
- Animações discretas e com propósito (revelar seção, contar o total no simulador), com `prefers-reduced-motion` respeitado.
  Sem biblioteca pesada só para efeito.
- Acessibilidade: contraste AA, foco visível prateado, navegação por teclado e `aria-label` nos botões de ícone.

---

## 8. Proibido (nada genérico)

- Foto de banco de imagem, pessoa gerada por IA, ícone genérico de template, dourado, gradiente roxo/azul.
- Inter/Roboto/Poppins, cantos arredondados iguais em tudo, sombras borradas, emojis como ícone.
- Textos do tipo "Bem-vindo ao nosso site", "Qualidade e excelência", "Sua melhor versão".
- Inventar preço, horário, desconto, combo, avaliação, número de clientes, anos de experiência ou certificação.
- Newsletter, pop-up, widget de chat de terceiros, carrossel automático no hero. O ícone flutuante do WhatsApp do item 12 pode ser usado.

**Teste final de troca de marca:** se eu trocar a logo por outra, o site ainda parece do Império Dantas?
Se a resposta for não, a identidade está fraca. Reforce os elementos de assinatura da seção 3.

---

## 9. Entrega

1. Estrutura de pastas: `index.html`, `css/`, `js/`, `img/` (otimizadas), `sitemap.xml`, `robots.txt`.
2. Lista de todos os placeholders `[...]` que eu preciso preencher.
3. Checklist conferido: dados fixos iguais à seção 1 · schema válido (testar no Rich Results Test) · Lighthouse mobile
   (Performance, SEO, Acessibilidade ≥ 90) · teste em 375px e 1440px · todos os links do WhatsApp funcionando.
4. Antes de codar, me mostre em poucas linhas a direção visual (cores, fontes, elementos de assinatura) e o recorte da foto do salão.

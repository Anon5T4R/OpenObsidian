# Limitações assumidas do OpenObsidian desktop

Estado em **v1.2.1**, 21/07/2026.

Cada item aqui é uma coisa que o app **não faz**, de propósito ou por custo. O
backlog de 25 itens que originou o app está fechado; isto é o que sobrou depois
dele, para ser reavaliado quando algum destes casos começar a doer de verdade.

Cada entrada traz **o que é**, **por que está assim** (com o ponteiro no
código), **o que custaria consertar** e um gatilho de reabertura — a condição
que, se acontecer, muda a resposta.

> Uma limitação assumida tem validade. O item 10 do backlog (callouts
> aninhados) foi descartado com bom argumento e **teve de ser reaberto** quando
> o cartão de flashcard virou um callout: uma verruga de renderização passou a
> ser perda de dado silenciosa. A pergunta certa nunca é "isso incomoda?", é
> "o que passou a depender disso desde a última vez que decidi?".

---

## 1. A busca não ignora acento nem faz stemming

**O que é.** `cefaleia` não encontra `cefaléia`. `hepatite` não encontra
`hepatites`. A busca é substring literal, insensível a maiúscula e nada mais.

**Por que.** `utils/searchQuery.ts` compara com `toLowerCase()` e `includes()`.
Não há normalização Unicode nem redução de radical em lugar nenhum.

**Consequência prática.** É o motivo pelo qual o vault mantém um bloco
"Busca rápida" com sinônimos em cada nota — um alias pobre, escrito à mão,
que existe para compensar isto.

**O que custaria.**

- *Acento*: pequeno. `.normalize('NFD').replace(/\p{Diacritic}/gu, '')` nos dois
  lados da comparação. O risco é o realce do trecho: hoje o índice do match
  serve direto para destacar, e normalizar muda o comprimento da string, então
  o realce precisa mapear de volta para o texto original. **É aí que mora o
  trabalho real, não na comparação.**
- *Stemming*: grande, e específico por idioma. Um vault trilíngue precisaria de
  três dicionários. Fora de proporção.

**Gatilho de reabertura.** Se a busca sem acento for feita, o bloco
"Busca rápida" deixa de ser obrigatório — o que muda a convenção de escrita de
~470 notas. Vale avaliar junto, não isolado.

**Recomendação.** Acento sim, em algum momento. Stemming não.

---

## 2. O filtro da barra lateral não olha o conteúdo

**O que é.** O campo de filtro casa nome, tags e aliases. Não casa o texto da
nota.

**Por que.** Decisão de custo: `FileTree.tsx` filtra a árvore a cada tecla, e
ler o conteúdo de todas as notas nesse laço duplicaria o painel de busca.

**Consequência.** Nomes de arquivo precisam ser autoexplicativos.

**O que custaria.** Pequeno em código — o cache de conteúdo já está em memória.
O problema é de produto: viraria uma segunda busca, pior que a que já existe
(sem operadores, sem ranking, sem contexto do trecho), no lugar errado da tela.

**Gatilho.** Se alguém pedir "filtrar por conteúdo", a resposta certa
provavelmente é abrir o painel de busca com o termo já preenchido, não engordar
o filtro.

**Recomendação.** Manter. Considerar o atalho "jogar o filtro para a busca".

---

## 3. `[[Nota#^bloco]]` abre a nota mas não rola

**O que é.** Âncora de seção (`#Seção`) funciona. Âncora de **bloco** (`#^id`)
só abre a nota.

**Por que.** Não existe renderização de id de bloco: nada no pipeline lê um
`^id` no fim de um parágrafo nem emite âncora para ele.

**O que custaria.** Médio. Um transform novo que reconheça `^id` no fim de
bloco, o remova da saída visível e emita `id="^id"`, mais o lado da resolução
em `linkResolver`. O detalhe chato é que o Obsidian **gera** esses ids ao
copiar um link de bloco; sem isso, o usuário teria de escrevê-los à mão, e aí
quase ninguém usa.

**Gatilho.** Importar um vault do Obsidian que já use links de bloco. Aí eles
existem sem ninguém ter digitado, e a limitação passa a quebrar conteúdo
alheio em vez de negar uma feature.

**Recomendação.** Esperar o gatilho.

---

## 4. Imagens somem ao converter `.docx`/`.odt` para Markdown

**O que é.** A conversão traz texto, títulos, listas e tabelas. Imagens
embutidas desaparecem sem aviso.

**Por que.** O `mammoth` descarta imagens na configuração padrão.

**Este é o pior da lista**, porque é o único que **perde conteúdo em silêncio**.
Todos os outros negam uma capacidade; este apaga algo que existia no arquivo de
origem.

**O que custaria.** Pequeno-médio. O mammoth tem `convertImage`: dá para
receber o buffer, gravar em `_attachments/` e emitir `![](...)`. O `.odt` é
código nosso (`main/odt.ts`), então lá é ler as imagens do ZIP.

**Gatilho.** Nenhum — já está atendido. **A meia-medida barata é avisar**: se a
conversão descartou N imagens, dizer no toast. Converte perda silenciosa em
perda visível, que é a regra que o resto do app segue.

**Recomendação.** Fazer pelo menos o aviso. É desproporcional que isto seja o
único ponto do app que perde dado calado.

---

## 5. `sort: criado` depende de um campo que você escreve, em ISO

**O que é.** Ordenar por criação lê `created:`/`criado:` do frontmatter e
compara como texto. Sem o campo, ou fora de `AAAA-MM-DD`, o app avisa acima do
resultado (desde a v1.2.1) mas não conserta.

**Por que.** Não existe data de criação no disco que sobreviva a uma
sincronização ou a uma cópia — `birthtime` se perde. E normalizar `DD/MM/AAAA`
seria adivinhar: `03/01/2026` é 3 de janeiro para metade do mundo.

**O que custaria consertar de verdade.** Exigiria uma configuração explícita de
formato de data por vault. Muita cerimônia para uma chave de ordenação.

**Divergência com o Android:** lá o `SortKey` é só `{TITLE, MODIFIED, PATH}`, e
`sort: criado` é sempre recusado como linha ilegível. Um índice que funciona no
desktop mostra aviso no celular.

**Recomendação.** Manter, e alinhar o Android — ou os dois aceitam com ISO, ou
os dois recusam.

---

## 6. O bloco `query` não tem OU, negação, agrupamento nem contagem

**O que é.** Duas linhas `tag:` **se somam** (E). Não há `-tag` para excluir,
nem agrupar por tag, nem "42 notas em cardiologia". O resultado é sempre uma
lista de wikilinks.

**Cuidado com a vírgula.** `tag: a, b` também é **E**, mas `campo: a, b` é
**OU** (`noteQuery.ts`, `matchesQuery`). É inconsistente, e vírgula lida como
"ou" é a leitura natural — quem escreve `tag: sis-cardio, sis-pneumo`
provavelmente queria as duas áreas e recebe lista vazia. **O único teste sobre
vírgula testa o parsing, nunca o casamento**, então isto é lacuna, não decisão.

**O que custaria.** O OU por vírgula é pequeno — mas **muda o resultado de
consultas que hoje funcionam**, então não é mudança silenciosa: precisa de
decisão explícita e provavelmente de uma varredura nos vaults conhecidos.

**Recomendação.** Resolver a inconsistência da vírgula é o item de maior
retorno do `query` hoje. Contagem e agrupamento, não — quem precisa disso
quer Dataview, e este bloco nunca vai ser Dataview.

---

## 7. Consulta sem filtro devolve nada

**O que é.** `sort: modificado desc` + `limit: 10` sozinhos devolvem lista
vazia. Não dá para pedir "as 10 notas mais recentes do vault inteiro".

**Por que.** `isEmptySpec` — uma consulta sem filtro listaria o vault todo, que
raramente é a intenção. Está fixado em teste.

**O que custaria.** Trivial: tratar um `limit:` explícito como intenção
suficiente. É defensável — "me dê as 10 mais recentes" é um pedido legítimo.

**Gatilho.** Já existe: um `/recentes` e um `/dashboard` foram descartados por
causa disto. É a limitação que mais bloqueia features novas.

**Recomendação.** Reabrir. É a de melhor relação custo/benefício da lista.

---

## 8. Sem visualização de tabela no modo edição

Fechado de propósito. O modo dividido resolve, e um widget WYSIWYG de tabela
dentro do CodeMirror é uma superfície grande de problema para uma dor que já
tem resposta. **Sem gatilho previsto.**

---

## 9. Sem histórico de versões por nota

Fechado de propósito. As notas são arquivos numa pasta que o usuário já
sincroniza (OneDrive, Drive, git), e essas ferramentas versionam. O único caso
que doeria — renomear reescrevendo links em dezenas de notas — já pede
confirmação e informa a contagem antes.

**Gatilho.** Se aparecer uma operação em massa que **não** peça confirmação.
Hoje não existe.

---

## 10. PDF nunca é lido como texto

O conteúdo de um `.pdf` não entra na busca do vault: `store.setActiveContent('')`
para binários. Extrair texto de PDF no renderer é peso considerável
(pdf.js) para uma busca que ficaria pior que a do próprio leitor.

**Gatilho.** Um acervo grande de PDF que precise ser buscável. Aí a resposta
provavelmente é indexar no processo principal, não no renderer.

---

## 11. Teste unitário verde não prova que `.odt` e `.apkg` abrem

`adm-zip` devolve string vazia sob vitest/jsdom, então os testes de `.odt`
cobrem só `odtToHtml(xml)` — o caminho que lê o ZIP tem de ser exercitado em
Node puro. O mesmo vale para o `sql-wasm.wasm` do import do Anki, que precisa
ser verificado no **pacote** (`electron-builder --dir`), não só em dev.

Não é limitação do produto, é do arnês de teste — mas mora aqui porque é a que
mais engana: a suíte verde não cobre o que parece cobrir.

---

## Como usar este documento

Ao reavaliar um item, a pergunta não é "isso ainda incomoda?" e sim **"o que
passou a depender disso desde a última decisão?"**. Foi essa pergunta que
reabriu os callouts aninhados, e é a única que teria reaberto a tempo.

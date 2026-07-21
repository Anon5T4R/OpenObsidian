// Ready-to-paste instructions for *any* AI chat.
// The point is not to call a model from inside the app: it is to hand the user
// a prompt that teaches the syntax, so they can use whichever chat they
// already pay for and paste the result straight back into the note.

import type { Locale } from '../i18n'

export type PromptKind = 'flashcards' | 'template' | 'summary'

const CARD_SYNTAX = `> [!card]- <pergunta>
> <resposta>

> [!card] <título>
> frase com ==termos== destacados   (cada destaque vira uma lacuna)

> [!mnemonic]? <título>
> <o mnemônico>`

const CARD_SYNTAX_EN = `> [!card]- <question>
> <answer>

> [!card] <title>
> sentence with ==highlighted== terms   (each highlight becomes a gap)

> [!mnemonic]? <title>
> <the mnemonic>`

const PT = {
  flashcards: (content: string) => `Você vai criar flashcards de estudo a partir da nota abaixo.

REGRAS DE FORMATO (obrigatórias — é a sintaxe do meu app de notas):

${CARD_SYNTAX}

- Uma pergunta objetiva por cartão, resposta curta e completa.
- Não invente conteúdo que não esteja na nota.
- Prefira perguntas que cobrem conduta, valores de corte e critérios.
- Responda SOMENTE com os cartões, sem introdução nem comentários.

NOTA:

${content}`,

  template: (content: string) => `Você vai preencher o modelo de nota abaixo.

REGRAS:
- Mantenha exatamente os títulos e a estrutura do modelo.
- Onde houver {{title}}, {{date}} ou {{time}}, deixe como está — meu app substitui.
- Não acrescente seções que não existem no modelo.
- Responda SOMENTE com o Markdown final.

MODELO:

${content}`,

  summary: (content: string) => `Resuma a nota abaixo em Markdown.

REGRAS:
- Comece com um parágrafo curto de visão geral.
- Depois, bullets com o que muda conduta (valores, critérios, doses).
- Mantenha os [[wikilinks]] e as #tags que já existem no texto.
- Responda SOMENTE com o Markdown, sem introdução.

NOTA:

${content}`,
}

const EN = {
  flashcards: (content: string) => `Create study flashcards from the note below.

FORMAT RULES (required — this is my note app's syntax):

${CARD_SYNTAX_EN}

- One objective question per card, with a short but complete answer.
- Do not invent anything that is not in the note.
- Prefer questions covering decisions, cut-off values and criteria.
- Reply with the cards ONLY, no preamble.

NOTE:

${content}`,

  template: (content: string) => `Fill in the note template below.

RULES:
- Keep the template's headings and structure exactly as they are.
- Leave {{title}}, {{date}} and {{time}} untouched — my app replaces them.
- Do not add sections the template does not have.
- Reply with the final Markdown ONLY.

TEMPLATE:

${content}`,

  summary: (content: string) => `Summarise the note below in Markdown.

RULES:
- Start with a short overview paragraph.
- Then bullets with what changes a decision (values, criteria, doses).
- Keep the [[wikilinks]] and #tags already in the text.
- Reply with the Markdown ONLY, no preamble.

NOTE:

${content}`,
}

/** The prompt text, in the user's language, with the note already embedded. */
export function buildAiPrompt(kind: PromptKind, content: string, locale: Locale): string {
  const table = locale === 'en-US' ? EN : PT
  return table[kind](content.trim())
}

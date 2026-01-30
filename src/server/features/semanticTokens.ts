import {
  SemanticTokensBuilder,
  type Connection,
  type ServerCapabilities,
} from 'vscode-languageserver'
import type { FeatureContext } from './types'
import type { OhmAST } from '../../core/ast'

// https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
export const SemanticHighlight = {
  class: 0,
  interface: 1,
  namespace: 2,
} as const

// https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
export const SemanticModifier = {
  declaration: 1 << 0,
  definition: 2 << 1,
} as const

export const semanticConfig: ServerCapabilities['semanticTokensProvider'] = {
  legend: {
    tokenTypes: Object.keys(SemanticHighlight),
    tokenModifiers: Object.keys(SemanticModifier),
  },
}

export function registerSemanticTokens(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console

  connection.languages.semanticTokens.on(async (params) => {
    const { textDocument } = params

    log.info(`[f:semantic-tokens]: ${textDocument.uri}`)

    const ast = await ohm.getGrammar(textDocument.uri)

    const builder = new SemanticTokensBuilder()

    ast?.grammars.forEach((g) => {
      pushToken(g.ident, SemanticHighlight.class)

      if (g.super) {
        pushToken(g.super, SemanticHighlight.namespace)
      }

      g.rules.forEach((rule) => {
        pushToken(rule.name, SemanticHighlight.interface)
      })
    })

    return builder.build()

    function pushToken(
      token: OhmAST.Token,
      type: number,
      mod: number = SemanticModifier.declaration,
    ) {
      builder.push(
        token.range.start.line,
        token.range.start.character,
        token._source.length,
        type,
        mod,
      )
    }
  })
}

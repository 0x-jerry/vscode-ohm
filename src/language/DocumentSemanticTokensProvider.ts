import {
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type DocumentSemanticTokensProvider,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  EventEmitter,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmAST } from '../core/ast'
import type { OhmLanguage } from '../core/OhmLanguage'

// https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
const SemanticHighlight = {
  class: 0,
  interface: 1,
  namespace: 2,
} as const

// https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
const SemanticModifier = {
  declaration: 1 << 0,
  definition: 2 << 1,
} as const

const tokenTypes = Object.keys(SemanticHighlight)
const tokenModifiers = Object.keys(SemanticModifier)

const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers)

export class DocumentSemanticTokensProviderImpl
  extends DisposableImpl
  implements DocumentSemanticTokensProvider
{
  static legend = legend

  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  onDidChangeEmitter = new EventEmitter<void>()

  onDidChangeSemanticTokens = this.onDidChangeEmitter.event

  async provideDocumentSemanticTokens(
    document: TextDocument,
    token: CancellationToken,
  ): Promise<SemanticTokens> {
    const ast = await this.ohm.getGrammar(document.uri.toString())

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
  }
}

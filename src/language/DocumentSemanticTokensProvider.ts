import {
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type DocumentSemanticTokensProvider,
  SemanticTokens,
  type Event,
  SemanticTokensBuilder,
  SemanticTokensLegend,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmLanguage } from './OhmLanguage'

enum SemanticHighlight {
  class = 'entity.name.class',
  interface = 'entity.name.type',
  keyword = 'keyword',
  operator = 'keyword.operator',
}

// const tokenTypes = ['class', 'interface', 'enum', 'function', 'variable'];
// const tokenModifiers = ['declaration', 'documentation'];
const legend = new SemanticTokensLegend([], [])

export class DocumentSemanticTokensProviderImpl
  extends DisposableImpl
  implements DocumentSemanticTokensProvider
{
  static legend = legend

  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  onDidChangeSemanticTokens?: Event<void> | undefined

  provideDocumentSemanticTokens(
    document: TextDocument,
    token: CancellationToken,
  ): ProviderResult<SemanticTokens> {
    const grammar = this.ohm.getGrammar(document.uri)

    // const tokens: SemanticTokens = []
    const tokensBuilder = new SemanticTokensBuilder()

    grammar?.grammars.forEach((g) => {
      tokensBuilder.push(g.ident.range, SemanticHighlight.class)

      if (g.super) {
        tokensBuilder.push(g.super.range, SemanticHighlight.class)
      }

      g.rules.forEach((rule) => {
        tokensBuilder.push(rule.name.range, SemanticHighlight.interface)
      })
    })

    return tokensBuilder.build()
  }
}

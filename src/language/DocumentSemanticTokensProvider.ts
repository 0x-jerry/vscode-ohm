import {
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type DocumentSemanticTokensProvider,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  EventEmitter
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmLanguage } from './OhmLanguage'

enum SemanticHighlight {
  class = 'class',
  interface = 'function',
  keyword = 'keyword',
  operator = 'operator'
}

const tokenTypes = Object.values(SemanticHighlight)
const tokenModifiers: string[] = []

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

  provideDocumentSemanticTokens(
    document: TextDocument,
    token: CancellationToken
  ): ProviderResult<SemanticTokens> {
    const grammar = this.ohm.getGrammar(document.uri)

    const tokensBuilder = new SemanticTokensBuilder(legend)

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

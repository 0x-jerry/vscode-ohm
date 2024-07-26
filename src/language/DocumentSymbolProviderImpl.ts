import {
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type DocumentSymbolProvider,
  Location,
  DocumentSymbol,
  SymbolInformation,
  SymbolKind,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmLanguage } from './Language'
import { locationToRange } from './utils'

export class DocumentSymbolProviderImpl
  extends DisposableImpl
  implements DocumentSymbolProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  provideDocumentSymbols(
    document: TextDocument,
    token: CancellationToken,
  ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
    const uri = document.uri
    const ast = this.ohm.getGrammar(uri)
    if (!ast) return

    const symbols: SymbolInformation[] = []

    ast.grammars.forEach((g) => {
      g.rules.forEach((rule) => {
        const s = new SymbolInformation(
          rule.name._source,
          SymbolKind.Interface,
          rule.root?.ident._source || 'root',
          new Location(uri, locationToRange(rule.name)),
        )

        symbols.push(s)
      })
    })

    return symbols
  }
}

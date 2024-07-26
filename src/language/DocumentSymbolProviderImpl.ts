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
import type { OhmLanguage } from './OhmLanguage'

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
    const symbols: SymbolInformation[] = []

    const allRules = this.ohm.filterRules(document.uri)
    allRules.forEach((rule) => {
      const s = new SymbolInformation(
        rule.name._source,
        SymbolKind.Interface,
        rule.root?.ident._source || 'root',
        new Location(rule.uri, rule.name.range),
      )

      symbols.push(s)
    })

    return symbols
  }
}

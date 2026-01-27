import {
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type DocumentSymbolProvider,
  Location,
  DocumentSymbol,
  SymbolInformation,
  SymbolKind,
  Uri,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import { toRange } from './utils'
import type { OhmLanguage } from '../core/OhmLanguage'

export class DocumentSymbolProviderImpl
  extends DisposableImpl
  implements DocumentSymbolProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  async provideDocumentSymbols(
    document: TextDocument,
    token: CancellationToken,
  ): Promise<SymbolInformation[] | DocumentSymbol[] | null | undefined> {
    const symbols: SymbolInformation[] = []

    const allRules = await this.ohm.filterRules(document.uri.toString(), {
      includeRefs: true,
    })

    allRules.forEach((rule) => {
      const s = new SymbolInformation(
        rule.name._source,
        SymbolKind.Interface,
        rule.root?.ident._source || 'root',
        new Location(Uri.parse(rule.uri), toRange(rule.name.range)),
      )

      symbols.push(s)
    })

    return symbols
  }
}

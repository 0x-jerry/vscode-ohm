import {
  Position,
  Range,
  Location,
  type CancellationToken,
  type Definition,
  type DefinitionLink,
  type DefinitionProvider,
  type ProviderResult,
  type TextDocument,
  Uri,
  type LocationLink,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import { toRange } from './utils'
import type { OhmLanguage } from '../core/OhmLanguage'

export class DefinitionProviderImpl
  extends DisposableImpl
  implements DefinitionProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  async provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | LocationLink[] | null | undefined> {
    const doc = document
    const wordRange = doc.getWordRangeAtPosition(position)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = await this.ohm.filterRules(doc.uri.toString(), {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    return rules.map((item) => {
      return new Location(Uri.parse(item.uri), toRange(item.range))
    })
  }
}

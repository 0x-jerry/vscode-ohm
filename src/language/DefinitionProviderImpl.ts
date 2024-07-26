import {
  Position,
  Range,
  Location,
  type CancellationToken,
  type Definition,
  type DefinitionLink,
  type DefinitionProvider,
  type ProviderResult,
  type TextDocument
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmLanguage } from './OhmLanguage'

export class DefinitionProviderImpl
  extends DisposableImpl
  implements DefinitionProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Definition | DefinitionLink[]> {
    const doc = document
    const wordRange = doc.getWordRangeAtPosition(position)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = this.ohm.filterRules(
      doc.uri,
      (rule) => rule.name._source === word
    )

    return rules.map((item) => {
      const d = new Location(item.uri, item.range)
      return d
    })
  }
}

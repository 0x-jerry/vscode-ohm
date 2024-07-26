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
    token: CancellationToken,
  ): ProviderResult<Definition | DefinitionLink[]> {
    const doc = document
    const wordRange = doc.getWordRangeAtPosition(position)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = this.ohm.filterRules(
      doc.uri,
      (rule) => rule.name._source === word,
    )

    return rules.map((item) => {
      const start = new Position(
        item.range.lineNum - 1,
        item.range.colNum - 1,
      )
      const end = new Position(
        item.range.lineNum - 1,
        item.range.colNum - 1 + item.name._source.length,
      )

      const d = new Location(item.uri, new Range(start, end))
      return d
    })
  }
}

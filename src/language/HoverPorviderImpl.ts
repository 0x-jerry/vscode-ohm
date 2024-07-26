import {
  Position,
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type HoverProvider,
  Hover,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmLanguage } from './OhmLanguage'

export class HoverProviderImpl extends DisposableImpl implements HoverProvider {
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  provideHover(
    doc: TextDocument,
    position: Position,
    token: CancellationToken,
  ): ProviderResult<Hover> {
    const wordRange = doc.getWordRangeAtPosition(position)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = this.ohm.filterRules(
      doc.uri,
      (rule) => rule.name._source === word,
    )

    const rule = rules.at(0)

    if (!rule) return

    const desc = rule._source

    const ns = rule.root?.ident._source || '_'

    const mdStr = ['```ohm', `${ns} {`, '  ' + desc, '}', '```'].join('\n')

    return new Hover(mdStr)
  }
}

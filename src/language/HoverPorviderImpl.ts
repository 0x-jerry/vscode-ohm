import {
  Position,
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type HoverProvider,
  Hover,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import { builtinRules } from '../core/ohm'
import type { OhmLanguage } from '../core/OhmLanguage'

export class HoverProviderImpl extends DisposableImpl implements HoverProvider {
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  async provideHover(
    doc: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | null | undefined> {
    const wordRange = doc.getWordRangeAtPosition(position)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = await this.ohm.filterRules(doc.uri.toString(), {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    if (rules.length) {
      const rule = rules.at(0)!

      const desc = rule._source

      const ns = rule.root?.ident._source || '_'

      const mdStr = ['```ohm', `${ns} {`, '  ' + desc, '}', '```'].join('\n')

      return new Hover(mdStr)
    }

    const builtinRule = builtinRules.find((n) => n.label === word)

    if (builtinRule?.documentation) {
      return new Hover(builtinRule.documentation)
    }
  }
}

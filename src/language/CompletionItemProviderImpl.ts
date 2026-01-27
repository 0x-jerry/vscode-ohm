import {
  Position,
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type CompletionItemProvider,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  type CompletionContext,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import { builtinRules } from '../core/ohm'
import { toRange } from './utils'
import type { OhmLanguage } from '../core/OhmLanguage'

export class CompletionItemProviderImpl
  extends DisposableImpl
  implements CompletionItemProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext,
  ): Promise<CompletionItem[]> {
    const completionItems: CompletionItem[] = []

    const allRules = await this.ohm.filterRules(document.uri.toString())

    allRules.forEach((rule) => {
      const item = new CompletionItem(
        rule.name._source,
        CompletionItemKind.Interface,
      )

      item.documentation = document.getText(toRange(rule.range))
      completionItems.push(item)
    })

    builtinRules.forEach((ruleItem) => {
      if (completionItems.find((n) => n.label === ruleItem.label)) {
        return
      }

      const item = new CompletionItem(
        ruleItem.label,
        CompletionItemKind.Interface,
      )
      item.documentation = ruleItem.documentation

      completionItems.push(item)
    })

    return completionItems
  }
}

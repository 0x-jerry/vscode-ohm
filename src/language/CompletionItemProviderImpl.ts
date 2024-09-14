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
import type { OhmLanguage } from './OhmLanguage'
import { builtinRules } from './ohm'

export class CompletionItemProviderImpl
  extends DisposableImpl
  implements CompletionItemProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext,
  ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
    const completionItems: CompletionItem[] = []

    const allRules = this.ohm.filterRules(document.uri)

    allRules.forEach((rule) => {
      const item = new CompletionItem(
        rule.name._source,
        CompletionItemKind.Interface,
      )

      item.documentation = document.getText(rule.range)
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

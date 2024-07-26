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
import type { OhmLanguage } from './Language'
import { locationToRange } from './utils'

interface BuiltinRule {
  label: string
  documentation?: string
}

/**
 * https://ohmjs.org/docs/syntax-reference#built-in-rules
 *
 * https://github.com/ohmjs/ohm/blob/cb3decc0b8d8c6300b7f591f13d5219314a0e3c0/packages/ohm-js/src/built-in-rules.ohm
 *
 */
const builtinRules: BuiltinRule[] = [
  {
    label: 'letter',
    documentation:
      'Matches a single character which is a letter (either uppercase or lowercase).',
  },
  {
    label: 'lower',
    documentation: 'Matches a single lowercase letter.',
  },
  {
    label: 'upper',
    documentation: 'Matches a single uppercase letter.',
  },
  {
    label: 'digit',
    documentation: 'Matches a single character which is a digit from 0 to 9.',
  },
  {
    label: 'hexDigit',
    documentation:
      'Matches a single character which is a either digit or a letter from A-F.',
  },
  {
    label: 'alnum',
    documentation:
      'Matches a single letter or digit; equivalent to `letter | digit`.',
  },
  {
    label: 'space',
    documentation:
      'Matches a single whitespace character (e.g., space, tab, newline, etc.)',
  },
  {
    label: 'end',
    documentation: 'Matches the end of the input stream. Equivalent to ~any.',
  },
  {
    label: 'ListOf',
  },
  {
    label: 'EmptyListOf',
  },
  {
    label: 'NonemptyListOf',
  },
  {
    label: 'listOf',
  },
  {
    label: 'emptyListOf',
  },
  {
    label: 'nonemptyListOf',
  },
  {
    label: 'applySyntactic',
  },
  {
    label: 'caseInsensitive',
  },
]

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
    const uri = document.uri
    const ast = this.ohm._astMap.get(uri.toString())
    if (!ast) return

    const completionItems: CompletionItem[] = []

    ast.grammars.forEach((g) => {
      g.rules.forEach((rule) => {
        const item = new CompletionItem(
          rule.name._source,
          CompletionItemKind.Interface,
        )

        item.documentation = document.getText(locationToRange(rule))
        completionItems.push(item)
      })
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

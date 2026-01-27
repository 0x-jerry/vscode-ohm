import {
  Position,
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type RenameProvider,
  Range,
  WorkspaceEdit,
  Uri,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import { toRange } from './utils'
import type { OhmLanguage } from '../core/OhmLanguage'

export class RenameProviderImpl
  extends DisposableImpl
  implements RenameProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  async provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    token: CancellationToken,
  ): Promise<WorkspaceEdit | null | undefined> {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)

    const edit = new WorkspaceEdit()

    await this.ohm.filterRules(document.uri.toString(), {
      includeRefs: true,
      filter: (rule) => {
        if (rule.name._source === word) {
          const range = toRange(rule.name.range)
          edit.replace(Uri.parse(rule.uri), range, newName)
        }

        rule.body.forEach((seq) => {
          seq.terms.forEach((term) => {
            if (term._source === word) {
              const range = toRange(term.range)
              edit.replace(Uri.parse(rule.uri), range, newName)
            }
          })
        })

        return true
      },
    })

    return edit
  }

  async prepareRename(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Range | { range: Range; placeholder: string } | null | undefined> {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)

    const uri = document.uri
    const ast = await this.ohm.getGrammar(uri.toString())
    if (!ast) return

    const rules = await this.ohm.filterRules(uri.toString(), {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    return rules.length > 0 ? wordRange : null
  }
}

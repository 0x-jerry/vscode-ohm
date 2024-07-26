import {
  Position,
  type CancellationToken,
  type ProviderResult,
  type TextDocument,
  type RenameProvider,
  Range,
  WorkspaceEdit,
} from 'vscode'
import { DisposableImpl } from './DisposableImpl'
import type { OhmLanguage } from './OhmLanguage'

export class RenameProviderImpl
  extends DisposableImpl
  implements RenameProvider
{
  constructor(readonly ohm: OhmLanguage) {
    super()
  }

  provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    token: CancellationToken,
  ): ProviderResult<WorkspaceEdit> {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)

    const edit = new WorkspaceEdit()

    this.ohm.filterRules(document.uri, (rule) => {
      if (rule.name._source === word) {
        const range = rule.name.range
        edit.replace(rule.uri, range, newName)
      }

      rule.body.forEach((seq) => {
        seq.terms.forEach((term) => {
          if (term.ident?._source === word) {
            const range = term.ident.range
            edit.replace(rule.uri, range, newName)
          }
        })
      })

      return true
    })

    return edit
  }

  prepareRename(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): ProviderResult<Range | { range: Range; placeholder: string }> {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)

    const uri = document.uri
    const ast = this.ohm.getGrammar(uri)
    if (!ast) return

    const hasRule =
      this.ohm.filterRules(document.uri, (rule) => rule.name._source === word)
        .length > 0

    return hasRule ? wordRange : null
  }
}

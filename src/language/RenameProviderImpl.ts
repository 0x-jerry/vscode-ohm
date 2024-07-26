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
import type { OhmLanguage } from './Language'
import { locationToRange } from './utils'

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

    const uri = document.uri
    const ast = this.ohm._astMap.get(uri.toString())
    if (!ast) return

    const edit = new WorkspaceEdit()

    ast.grammars.forEach((grammar) => {
      grammar.rules.forEach((rule) => {
        if (rule.name._source === word) {
          const range = locationToRange(rule.name)
          edit.replace(uri, range, newName)
        }

        rule.body.forEach((seq) => {
          seq.terms.forEach((term) => {
            if (term.ident?._source === word) {
              const range = locationToRange(term.ident)
              edit.replace(uri, range, newName)
            }
          })
        })
      })
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
    const ast = this.ohm._astMap.get(uri.toString())
    if (!ast) return

    const hasRule = ast.grammars.some((g) =>
      g.rules.some((r) => r.name._source === word),
    )

    return hasRule ? wordRange : null
  }
}

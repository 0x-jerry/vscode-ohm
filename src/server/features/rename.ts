import type { Connection, TextEdit, WorkspaceEdit } from 'vscode-languageserver'
import type { FeatureContext } from './types'

export function registerRename(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console

  connection.onPrepareRename(async (params) => {
    const { textDocument, position } = params
    const uri = textDocument.uri

    log.info(`[f:prepare-rename]: ${uri}`)

    const word = fs.getWordAtPosition(uri, position)

    const ast = await ohm.getGrammar(uri)
    if (!ast) return

    const rules = await ohm.filterRules(uri, {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    return rules.length > 0 ? fs.getWordRangeAtPosition(uri, position) : null
  })

  connection.onRenameRequest(async (params) => {
    const { textDocument, position, newName } = params
    const uri = textDocument.uri
    log.info(`[f:rename]: ${uri}`)
    const word = fs.getWordAtPosition(uri, position)

    if (!word) {
      return null
    }

    const edit: WorkspaceEdit = {
      changes: {},
    }

    await ohm.forEachRules(
      uri,
      (rule) => {
        if (rule.name._source === word) {
          const range = rule.name.range

          pushChange(rule.uri, {
            newText: newName,
            range,
          })
        }

        rule.body.forEach((seq) => {
          seq.terms.forEach((term) => {
            if (term._source === word) {
              const range = term.range

              pushChange(rule.uri, {
                newText: newName,
                range,
              })
            }
          })
        })
      },
      {
        includeRefs: true,
      },
    )

    return edit

    function pushChange(uri: string, change: TextEdit) {
      edit.changes ||= {}
      edit.changes[uri] ||= []
      edit.changes[uri].push(change)
    }
  })
}

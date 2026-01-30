import {
  CompletionItem,
  CompletionItemKind,
  type Connection,
  type ServerCapabilities,
} from 'vscode-languageserver'
import type { FeatureContext } from './types'
import { builtinRules } from '../../core/ohm'

export const completionConfig: ServerCapabilities['completionProvider'] = {
  triggerCharacters: [' '],
}

export function registerCompletion(
  connection: Connection,
  { ohm }: FeatureContext,
) {
  const log = connection.console

  connection.onCompletion(async (params) => {
    const { textDocument } = params
    log.info(`[f:completion]: ${textDocument.uri}`)

    const rules = await ohm.filterRules(textDocument.uri)

    const completionItems = rules.map((rule) => {
      const item: CompletionItem = {
        label: rule.name._source,
        kind: CompletionItemKind.Interface,
        documentation: rule._source,
      }

      return item
    })

    const builtinCompletionItems = builtinRules.map((rule) => {
      const item: CompletionItem = {
        label: rule.label,
        kind: CompletionItemKind.Interface,
        documentation: rule.documentation,
      }

      return item
    })

    return [...completionItems, ...builtinCompletionItems]
  })
}

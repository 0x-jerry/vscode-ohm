import type { Connection, Definition } from 'vscode-languageserver'
import type { FeatureContext } from './types'

export function registerDefinition(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console

  connection.onDefinition(async (params) => {
    const { textDocument, position } = params

    log.info(`[f:definition]: ${textDocument.uri}`)

    const word = fs.getWordAtPosition(textDocument.uri, position)

    if (!word) {
      return null
    }

    const rules = await ohm.filterRules(textDocument.uri, {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    log.info(`rules for ${word}: ${rules.length}`)

    if (rules.length) {
      return rules.map((rule) => {
        const def: Definition = {
          range: rule.range,
          uri: rule.uri,
        }

        return def
      })
    }

    return null
  })
}

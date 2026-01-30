import type { Connection, Hover } from 'vscode-languageserver'
import type { FeatureContext } from './types'
import { builtinRules } from '../../core/ohm'

export function registerHover(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console
  connection.onHover(async (params) => {
    const { position, textDocument } = params

    log.info(`[f:hover]: ${textDocument.uri}`)

    const word = await fs.getWordAtPosition(textDocument.uri, position)

    if (!word) {
      return null
    }

    const rules = await ohm.filterRules(textDocument.uri, {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    log.info(`hover: rules for ${word}: ${rules.length}`)

    const hover: Hover = {
      contents: [],
    }

    if (rules.length) {
      hover.contents = rules.map((rule) => {
        const desc = rule._source

        const ns = rule.root?.ident._source || '_'

        const mdStr = ['```ohm', `${ns} {`, '  ' + desc, '}', '```'].join('\n')

        return mdStr
      })

      return hover
    }

    const matchedBuiltinRule = builtinRules.find((n) => n.label === word)

    if (matchedBuiltinRule?.documentation) {
      hover.contents = matchedBuiltinRule.documentation
      return hover
    }

    return null
  })
}

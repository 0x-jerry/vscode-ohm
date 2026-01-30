import type { Connection } from 'vscode-languageserver'
import type { FeatureContext } from './types'

export function registerDocumentSymbol(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console

  connection.onDocumentSymbol((params) => {
    const uri = params.textDocument.uri

    log.info(`[f:document-symbol]: ${uri}`)

    return ohm.getSymbols(uri)
  })
}

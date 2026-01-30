import type { Connection } from 'vscode-languageserver'
import type { FeatureContext } from './types'
import { registerRename } from './rename'
import { registerDefinition } from './definition'
import { registerCompletion } from './completion'
import { registerValidator } from './validator'
import { registerTrace } from './trace'
import { registerHover } from './hover'
import { registerSemanticTokens } from './semanticTokens'
import { registerDocumentSymbol } from './documentSymbol'
import { registerDiagnostics } from './diagnostics'

export function registerAllFeatures(
  connection: Connection,
  ctx: FeatureContext,
) {
  registerValidator(connection, ctx)
  registerTrace(connection, ctx)

  registerCompletion(connection, ctx)
  registerDefinition(connection, ctx)
  registerDiagnostics(connection, ctx)
  registerDocumentSymbol(connection, ctx)
  registerHover(connection, ctx)
  registerRename(connection, ctx)
  registerSemanticTokens(connection, ctx)
}

import {
  TextDocumentSyncKind,
  type Connection,
  type InitializeResult,
} from 'vscode-languageserver'
import { OhmLanguage } from './OhmLanguage'
import type { IFilesystem } from '../shared/FilesystemProtocol'
import { registerAllFeatures } from './features'
import { semanticConfig } from './features/semanticTokens'
import { completionConfig } from './features/completion'
import { diagnosticConfig } from './features/diagnostics'

export interface ServiceOption {
  connection: Connection
  fs: IFilesystem
}

export function startService(opt: ServiceOption) {
  const { connection, fs } = opt
  const log = connection.console

  const ohm = new OhmLanguage({
    log,
    fs,
  })

  connection.onInitialize((_params) => {
    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: {
          change: TextDocumentSyncKind.Incremental,
        },
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        semanticTokensProvider: semanticConfig,
        renameProvider: true,
        definitionProvider: true,
        hoverProvider: true,
        completionProvider: completionConfig,
        diagnosticProvider: diagnosticConfig,
        workspace: {
          workspaceFolders: {
            supported: true,
          },
        },
      },
    }

    log.info('Ohm LSP Initialized!')
    return result
  })

  registerAllFeatures(connection, { ohm, fs })

  connection.listen()
}

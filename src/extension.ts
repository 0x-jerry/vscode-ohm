import { workspace, type ExtensionContext } from 'vscode'

import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { registerProviders } from './language/OhmLanguage'

let client: LanguageClient

const USE_LSP = true

export async function activate(context: ExtensionContext) {
  if (USE_LSP) {
    startLSP(context)
  } else {
    registerProviders(context)
  }
}

async function startLSP(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath('dist/lsp/server.js')

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'ohm' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.ohm'),
    },
  }

  // Create the language client and start the client.
  client = new LanguageClient(
    'lsp.ohm',
    'Ohm Language Server',
    serverOptions,
    clientOptions,
  )

  // Start the client. This will also launch the server
  await client.start()
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}

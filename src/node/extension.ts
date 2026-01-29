import { workspace, type ExtensionContext } from 'vscode'

import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { registerClientServices } from '../client'

let client: LanguageClient

export async function activate(context: ExtensionContext) {
  client = startLSP(context)

  context.subscriptions.push(registerClientServices(client))
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}

function startLSP(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath('dist/node/lsp.js')

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
  const client = new LanguageClient(
    'lsp.ohm',
    'Ohm Language Server',
    serverOptions,
    clientOptions,
  )

  // Start the client. This will also launch the server
  client.start()

  return client
}

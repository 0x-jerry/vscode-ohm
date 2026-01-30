import { type ExtensionContext } from 'vscode'

import {
  LanguageClient,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { languageClientOptions, registerClientServices } from '../client'

export async function activate(context: ExtensionContext) {
  const client = startLSP(context)

  context.subscriptions.push({
    dispose() {
      client.stop()
    },
  })
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

  // Create the language client and start the client.
  const client = new LanguageClient(
    'lsp.ohm',
    'Ohm Language Server',
    serverOptions,
    languageClientOptions,
  )

  context.subscriptions.push(registerClientServices(client))

  // Start the client. This will also launch the server
  client.start()

  return client
}

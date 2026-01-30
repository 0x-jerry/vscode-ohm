import { Uri, window, type ExtensionContext, type OutputChannel } from 'vscode'
import { LanguageClient } from 'vscode-languageclient/browser'
import { languageClientOptions, registerClientServices } from '../client'

export async function activate(context: ExtensionContext) {
  const output = window.createOutputChannel('Ohm Language')
  context.subscriptions.push(output)

  const client = startLSP(context, output)

  context.subscriptions.push({
    dispose() {
      client.stop()
    },
  })
}

function startLSP(context: ExtensionContext, log: OutputChannel) {
  const serverMain = Uri.joinPath(context.extensionUri, 'dist/web/lsp.js')

  const worker = new Worker(serverMain.toString(true))

  // Create the language client and start the client.
  const client = new LanguageClient(
    'lsp.ohm',
    'Ohm Language Server',
    languageClientOptions,
    worker,
  )

  context.subscriptions.push(registerClientServices(client))

  // Start the client. This will also launch the server
  client.start()

  log.appendLine('Extension started!')

  return client
}

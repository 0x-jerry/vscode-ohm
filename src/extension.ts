import { type ExtensionContext } from 'vscode'
import { OhmLanguage } from './language/Language'

export async function activate(context: ExtensionContext) {
  console.log('activate')

  context.subscriptions.push(new OhmLanguage())
}

export function deactivate(): void {
  console.log('deactivate')
}

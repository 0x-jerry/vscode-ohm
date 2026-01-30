import { Disposable, workspace } from 'vscode'
import type {
  BaseLanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient'
import { registerValidatorService } from './registerValidatorService'
import { registerTraceService } from './registerTraceService'
import { registerFilesystemService } from './registerFilesystemService'

export const languageClientOptions: LanguageClientOptions = {
  documentSelector: [{ language: 'ohm' }, { pattern: '**/*.ohm' }],
  synchronize: {
    fileEvents: workspace.createFileSystemWatcher('**/*.ohm'),
  },
}

export function registerClientServices(client: BaseLanguageClient) {
  return Disposable.from(
    registerFilesystemService(client),
    registerValidatorService(client),
    registerTraceService(client),
  )
}

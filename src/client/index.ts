import { Disposable } from 'vscode'
import type { BaseLanguageClient } from 'vscode-languageclient'
import { registerValidatorService } from './registerValidatorService'
import { registerTraceService } from './registerTraceService'
import { registerFilesystemService } from './registerFilesystemService'

export function registerClientServices(client: BaseLanguageClient) {
  return Disposable.from(
    registerFilesystemService(client),
    registerValidatorService(client),
    registerTraceService(client),
  )
}

import {
  languages,
  workspace,
  Uri,
  Diagnostic,
  type ExtensionContext,
  Position,
  Range,
  type DocumentSelector,
  window,
  TabInputText,
} from 'vscode'
import { HoverProviderImpl } from './HoverPorviderImpl'
import { DefinitionProviderImpl } from './DefinitionProviderImpl'
import { DocumentSymbolProviderImpl } from './DocumentSymbolProviderImpl'
import { RenameProviderImpl } from './RenameProviderImpl'
import { CompletionItemProviderImpl } from './CompletionItemProviderImpl'
import { DocumentSemanticTokensProviderImpl } from './DocumentSemanticTokensProvider'
import { toRange } from './utils'
import { OhmLanguage } from '../core/OhmLanguage'
import type { IFilesystem } from '../core/types'
import { EventEmitter } from '@0x-jerry/utils'

interface IFSEvents {
  changed: [uri: string]
  removed: [uri: string]
}

class IFS implements IFilesystem {
  events = new EventEmitter<IFSEvents>()

  async readContent(uri: string): Promise<string | null> {
    const parsedUri = Uri.parse(uri)

    if (parsedUri.scheme !== 'file') {
      return null
    }

    const doc = await workspace.fs.readFile(parsedUri)

    const content = doc.toString()

    return content
  }

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'removed', callback: (uri: string) => void): void
  on(event: any, callback: any): void {
    this.events.on(event, callback)
  }
}

export function registerProviders(context: ExtensionContext) {
  const lang = 'ohm'
  const docSelector: DocumentSelector = { scheme: 'file', language: lang }

  const fs = new IFS()

  const ohm = new OhmLanguage({
    log: console,
    fs,
  })

  const diagnosticCollection = languages.createDiagnosticCollection(lang)

  const services = [
    languages.registerHoverProvider(docSelector, new HoverProviderImpl(ohm)),
    languages.registerDefinitionProvider(
      docSelector,
      new DefinitionProviderImpl(ohm),
    ),
    languages.registerDocumentSymbolProvider(
      docSelector,
      new DocumentSymbolProviderImpl(ohm),
    ),
    languages.registerRenameProvider(docSelector, new RenameProviderImpl(ohm)),
    languages.registerCompletionItemProvider(
      docSelector,
      new CompletionItemProviderImpl(ohm),
    ),
    languages.registerDocumentSemanticTokensProvider(
      docSelector,
      new DocumentSemanticTokensProviderImpl(ohm),
      DocumentSemanticTokensProviderImpl.legend,
    ),
    diagnosticCollection,
    workspace.onDidOpenTextDocument((doc) => {
      updateDiagnostic(doc.uri)
    }),
    workspace.onDidChangeTextDocument((changeEvt) => {
      const { document: doc } = changeEvt
      updateDiagnostic(doc.uri)
    }),
    workspace.onDidDeleteFiles((deleteEvt) => {
      deleteEvt.files.forEach((uri) => {
        fs.events.emit('removed', uri.toString())
      })
    }),
  ]

  services.forEach((disposable) => context.subscriptions.push(disposable))

  for (const file of getOpenedFileUris()) {
    updateDiagnostic(file)
  }

  async function updateDiagnostic(uri: Uri) {
    const data = await ohm.getInternalData(uri.toString())

    if (data.diagnostics.kind === 'unchanged') {
      return
    }

    const reports = data.diagnostics.items.map((item) => {
      item.severity
      const diagnostic = new Diagnostic(
        toRange(item.range),
        item.message,
        item.severity != null ? item.severity - 1 : undefined,
      )

      return diagnostic
    })

    diagnosticCollection.set(uri, reports)
  }
}

function getOpenedFileUris(): Uri[] {
  const uris: Uri[] = []

  for (const tabGroup of window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.input instanceof TabInputText) {
        uris.push(tab.input.uri)
      }
    }
  }

  return [...new Set(uris)]
}

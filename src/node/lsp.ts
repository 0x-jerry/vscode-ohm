import {
  createConnection,
  Position,
  ProposedFeatures,
  Range,
  TextDocuments,
} from 'vscode-languageserver/node'
import {
  getWordAtPosition,
  getWordRangeAtPosition,
} from '../utils/DocumentHelper'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { IFilesystem } from '../core/types'
import { EventEmitter } from '@0x-jerry/utils'
import { startService } from '../core/service'

class IFS implements IFilesystem {
  documents = new TextDocuments(TextDocument)
  events = new EventEmitter()

  async readContent(uri: string): Promise<string | null> {
    const doc = this.documents.get(uri)
    if (doc) {
      return doc.getText()
    }

    return readFile(fileURLToPath(uri), 'utf8')
  }

  getWordAtPosition(uri: string, position: Position) {
    const doc = this.documents.get(uri)
    if (!doc) {
      return
    }

    return getWordAtPosition(doc, position)
  }

  getWordRangeAtPosition(uri: string, position: Position) {
    const doc = this.documents.get(uri)
    if (!doc) {
      return
    }

    return getWordRangeAtPosition(doc, position)
  }

  getTextByRange(uri: string, range: Range) {
    return this.documents.get(uri)?.getText(range)
  }

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'removed', callback: (uri: string) => void): void
  on(event: any, callback: any): void {
    this.events.on(event, callback)
  }

  emit(event: string, ...data: any[]): void {
    this.events.emit(event, ...data)
  }
}

const connection = createConnection(ProposedFeatures.all)
const fs = new IFS()

fs.documents.listen(connection)

startService({
  connection,
  fs,
})

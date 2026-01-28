import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
  Position,
  Range,
  TextDocuments,
  type Connection,
} from 'vscode-languageserver/browser'
import {
  getWordAtPosition,
  getWordRangeAtPosition,
} from '../utils/DocumentHelper'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { IFilesystem } from '../core/types'
import { EventEmitter } from '@0x-jerry/utils'
import { startService } from '../core/service'

class IFS implements IFilesystem {
  documents = new TextDocuments(TextDocument)
  events = new EventEmitter()

  constructor(readonly conn: Connection) {}

  async readContent(uri: string): Promise<string | null> {
    const doc = this.documents.get(uri)

    if (doc?.getText().length) {
      return doc.getText()
    }

    const content = await this.conn.sendRequest<string>(
      'ohm/get-file-content',
      {
        uri,
      },
    )

    return content
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

const messageReader = new BrowserMessageReader(self)
const messageWriter = new BrowserMessageWriter(self)
const connection = createConnection(messageReader, messageWriter)
const fs = new IFS(connection)

fs.documents.listen(connection)

startService({
  connection,
  fs,
})

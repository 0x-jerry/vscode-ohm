import { EventEmitter, type Awaitable } from '@0x-jerry/utils'
import {
  TextDocument,
  type Position,
  type Range,
  type TextDocumentContentChangeEvent,
} from 'vscode-languageserver-textdocument'
import { getWordAtPosition, getWordRangeAtPosition } from './DocumentHelper'
import type { Connection } from 'vscode-languageserver'
import {
  FilesystemMethod,
  type FilesystemChangedParams,
  type FilesystemCommonParams,
  type FilesystemEvents,
  type FilesystemOpenedParams,
  type FilesystemRenameParams,
  type IFilesystem,
} from '../shared/FilesystemProtocol'

export class BaseFileSystem implements IFilesystem {
  documents = new Map<string, TextDocument>()

  events = new EventEmitter<FilesystemEvents>()

  get log() {
    return this.conn.console
  }

  constructor(readonly conn: Connection) {
    conn.onRequest(FilesystemMethod.Deleted, (evt: FilesystemCommonParams) => {
      this.log.info(`[fs:delete]: ${evt.uri}`)

      this.delete(evt.uri)
    })

    conn.onRequest(FilesystemMethod.Changed, (evt: FilesystemChangedParams) => {
      this.log.info(`[fs:change]: ${evt.uri}`)

      this.sync(evt.uri, evt.changes)
    })

    conn.onRequest(FilesystemMethod.Opened, (evt: FilesystemOpenedParams) => {
      this.log.info(`[fs:open]: ${evt.uri}`)

      this.create(evt.uri, evt.content)
    })

    conn.onRequest(FilesystemMethod.Rename, (evt: FilesystemRenameParams) => {
      this.log.info(`[fs:rename]: ${evt.uri} => ${evt.newUri}`)

      const doc = this.documents.get(evt.uri)

      if (!doc) {
        return
      }

      this.delete(evt.uri)
      this.create(evt.newUri, doc.getText())
    })
  }

  /**
   * Create a document
   * @param uri
   * @param content
   */
  create(uri: string, content: string) {
    if (this.documents.get(uri)?.getText() === content) {
      return
    }

    this.log.info(`[fs:create]: ${uri}`)

    const doc = TextDocument.create(uri, 'ohm', 0, content)

    this.documents.set(doc.uri, doc)
    this.events.emit('created', uri)
  }

  /**
   * Update a document
   * @param uri
   * @param changes
   * @returns
   */
  sync(uri: string, changes: TextDocumentContentChangeEvent[]) {
    let doc = this.documents.get(uri)

    if (!doc) {
      this.log.warn(`[fs:sync] Can not find file: ${uri}`)

      throw new Error(`Can not find file for ${uri}`)
    }

    try {
      TextDocument.update(doc, changes, doc.version + 1)
    } catch (error) {
      this.log.warn(`[fs:sync] Patch file failed: ${String(error)}`)
    }

    this.events.emit('changed', uri)
    return doc
  }

  delete(uri: string) {
    this.log.info(`[fs:delete]: ${uri}`)

    this.documents.delete(uri)
    this.events.emit('deleted', uri)
  }

  async readContent(uri: string): Promise<string | null> {
    let result = this.documents.get(uri)?.getText()

    if (result == null) {
      const params: FilesystemCommonParams = { uri }

      result = await this.conn.sendRequest<string | undefined>(
        FilesystemMethod.Read,
        params,
      )

      if (result != null) {
        this.create(uri, result)
      }
    }

    return result || null
  }

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'deleted', callback: (uri: string) => void): void
  on(event: any, callback: any): void {
    this.events.on(event, callback)
  }

  getWordAtPosition(
    uri: string,
    position: Position,
  ): Awaitable<string | null | undefined> {
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
}

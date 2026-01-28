import { EventEmitter, type Awaitable } from '@0x-jerry/utils'
import {
  TextDocument,
  type Position,
  type Range,
  type TextDocumentContentChangeEvent,
} from 'vscode-languageserver-textdocument'
import { getWordAtPosition, getWordRangeAtPosition } from './DocumentHelper'
import type { Connection } from 'vscode-languageserver'

export interface IFilesystem {
  readContent(uri: string): Promise<string | null>

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'deleted', callback: (uri: string) => void): void

  getWordAtPosition(
    uri: string,
    position: Position,
  ): Awaitable<string | null | undefined>
  getTextByRange(
    uri: string,
    range: Range,
  ): Awaitable<string | undefined | undefined>
  getWordRangeAtPosition(
    uri: string,
    position: Position,
  ): Awaitable<Range | null | undefined>
}

export const FilesystemMethod = {
  Read: 'ohm/file-read-content',
  Changed: 'ohm/file-content-changed',
  Deleted: 'ohm/file-deleted',
  Opened: 'ohm/file-opened',
} as const

export interface FilesystemCommonParams {
  uri: string
}

export interface FilesystemChangedParams {
  uri: string
  changes: TextDocumentContentChangeEvent[]
}

export interface FilesystemOpenedParams {
  uri: string
  content: string
}

export interface FilesystemEvents {
  deleted: [uri: string]
  changed: [uri: string]
}

export class BaseFileSystem implements IFilesystem {
  documents = new Map<string, TextDocument>()

  events = new EventEmitter<FilesystemEvents>()

  get log() {
    return this.conn.console
  }

  constructor(readonly conn: Connection) {
    conn.onRequest(
      FilesystemMethod.Deleted,
      ({ uri }: FilesystemCommonParams) => {
        this.log.info(`file removed: ${uri}`)
        this.delete(uri)
      },
    )

    conn.onRequest(FilesystemMethod.Changed, (evt: FilesystemChangedParams) => {
      this.log.info(`file changed: ${evt.uri}`)

      this.sync(evt.uri, evt.changes)
    })

    conn.onRequest(FilesystemMethod.Opened, (evt: FilesystemOpenedParams) => {
      const uri = evt.uri

      this.log.info(`file opened: ${uri}`)

      this.create(evt.uri, evt.content)
    })
  }

  /**
   * Create a document
   * @param uri
   * @param content
   */
  create(uri: string, content: string) {
    const doc = TextDocument.create(uri, 'ohm', 0, content)

    this.documents.set(doc.uri, doc)
    this.events.emit('changed', uri)
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
      this.log.warn(`Can not find file: ${uri}`)

      throw new Error(`Can not find file for ${uri}`)
    }

    try {
      TextDocument.update(doc, changes, doc.version + 1)
    } catch (error) {
      this.log.warn(`Patch file failed: ${String(error)}`)
      this.log.warn(`Patch params: ${uri}, ${JSON.stringify(changes)}`)
    }

    this.events.emit('changed', uri)
    return doc
  }

  delete(uri: string) {
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

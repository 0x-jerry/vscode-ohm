import { type Awaitable } from '@0x-jerry/utils'
import {
  type Position,
  type Range,
  type TextDocumentContentChangeEvent,
} from 'vscode-languageserver-textdocument'

export interface IFilesystem {
  readContent(uri: string): Promise<string | null>

  on<key extends keyof FilesystemEvents>(
    event: key,
    callback: (...args: FilesystemEvents[key]) => void,
  ): void

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
  created: [uri: string]
}

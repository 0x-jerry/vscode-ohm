import type { Position, Range } from 'vscode-languageserver'
import type { Awaitable } from '@0x-jerry/utils'

export interface IFilesystem {
  readContent: (uri: string) => Promise<string | null>

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'removed', callback: (uri: string) => void): void
  emit(event: string, ...data: any[]): void

  getWordAtPosition(uri: string, position: Position): Awaitable<string | null | undefined>
  getTextByRange(uri: string, range: Range): Awaitable<string | undefined | undefined>
  getWordRangeAtPosition(
    uri: string,
    position: Position,
  ): Awaitable<Range | null | undefined>
}

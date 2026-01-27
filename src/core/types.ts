export interface IFilesystem {
  readContent: (uri: string) => Promise<string | null>

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'removed', callback: (uri: string) => void): void
}

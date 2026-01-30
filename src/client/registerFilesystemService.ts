import { Disposable, Uri, workspace } from 'vscode'
import {
  FilesystemMethod,
  type FilesystemChangedParams,
  type FilesystemCommonParams,
  type FilesystemOpenedParams,
  type FilesystemRenameParams,
} from '../shared/FilesystemProtocol'
import type { BaseLanguageClient } from 'vscode-languageclient'
import type { TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'

export function registerFilesystemService(client: BaseLanguageClient) {
  const disposables: Disposable[] = [
    workspace.onDidDeleteFiles((evt) => {
      evt.files.forEach((file) => {
        if (!isOhmFile(file)) {
          return
        }

        const uri = file.toString()
        const params: FilesystemCommonParams = { uri }

        client.sendRequest(FilesystemMethod.Deleted, params)
      })
    }),
    workspace.onDidRenameFiles((evt) => {
      evt.files.forEach((evt) => {
        const params: FilesystemRenameParams = {
          uri: evt.oldUri.toString(),
          newUri: evt.newUri.toString(),
        }

        client.sendRequest(FilesystemMethod.Rename, params)
      })
    }),
    workspace.onDidChangeTextDocument((evt) => {
      const uri = evt.document.uri
      if (!isOhmFile(uri)) {
        return
      }

      const params: FilesystemChangedParams = {
        uri: uri.toString(),
        changes: evt.contentChanges.map((item) => {
          const c: TextDocumentContentChangeEvent = {
            text: item.text,
            range: {
              start: {
                line: item.range.start.line,
                character: item.range.start.character,
              },
              end: {
                line: item.range.end.line,
                character: item.range.end.character,
              },
            },
          }
          return c
        }),
      }

      client.sendRequest(FilesystemMethod.Changed, params)
    }),
    workspace.onDidOpenTextDocument((evt) => {
      const uri = evt.uri
      if (!isOhmFile(uri)) {
        return
      }

      const params: FilesystemOpenedParams = {
        uri: uri.toString(),
        content: evt.getText(),
      }

      client.sendRequest(FilesystemMethod.Opened, params)
    }),
  ]

  client.onRequest(
    FilesystemMethod.Read,
    async (evt: FilesystemCommonParams) => {
      const content = await workspace.fs.readFile(Uri.parse(evt.uri))

      const decoder = new TextDecoder()
      return decoder.decode(content)
    },
  )

  return Disposable.from(...disposables)
}

function isOhmFile(uri: Uri) {
  return uri.scheme === 'file' && uri.path.endsWith('.ohm')
}

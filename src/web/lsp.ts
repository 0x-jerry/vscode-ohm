import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser'
import { startService } from '../server/service'
import { BaseFileSystem } from '../server/FilesystemProtocol'

class IFS extends BaseFileSystem {}

const messageReader = new BrowserMessageReader(self)
const messageWriter = new BrowserMessageWriter(self)
const connection = createConnection(messageReader, messageWriter)

const fs = new IFS(connection)

startService({
  connection,
  fs,
})

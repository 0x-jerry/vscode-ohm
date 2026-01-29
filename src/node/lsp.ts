import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { startService } from '../server/service'
import { BaseFileSystem } from '../server/FilesystemProtocol'

class IFS extends BaseFileSystem {}

const connection = createConnection(ProposedFeatures.all)

const fs = new IFS(connection)

startService({
  connection,
  fs,
})

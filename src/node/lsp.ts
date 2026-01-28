import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { startService } from '../core/service'
import { BaseFileSystem } from '../common/FilesystemProtocol'

class IFS extends BaseFileSystem {}

const connection = createConnection(ProposedFeatures.all)

const fs = new IFS(connection)

startService({
  connection,
  fs,
})

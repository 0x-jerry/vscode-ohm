import {
  Diagnostic,
  Disposable,
  languages,
  Position,
  Range,
  Uri,
  workspace,
  type TextDocument,
} from 'vscode'
import type { BaseLanguageClient } from 'vscode-languageclient'
import picomatch from 'picomatch'
import {
  OhmProtocolMethod,
  type OhmValidateParams,
  type OhmValidateResult,
} from '../shared/OhmCustomProtocol'
import { ConfigKey, getConfig, getConfigKeyString } from './configuration'
import { convertRange } from './utils'

export function registerValidatorService(client: BaseLanguageClient) {
  const diagnosticCollection =
    languages.createDiagnosticCollection('ohm-validator')

  const disposables = [
    diagnosticCollection,
    workspace.onDidOpenTextDocument(async (doc) => {
      await validate(doc)
    }),
    workspace.onDidChangeTextDocument(async (evt) => {
      await validate(evt.document)
    }),
    workspace.onDidSaveTextDocument(async (evt) => {
      if (!isOhmFile(evt.uri)) {
        return
      }

      const docs = getMatchedDocsByGrammar(evt.uri) || []
      for (const doc of docs) {
        await validate(doc)
      }
    }),
    workspace.onDidCloseTextDocument(evt => {
      diagnosticCollection.delete(evt.uri)
    })
  ]

  workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration(getConfigKeyString(ConfigKey.validator))) {
      return
    }

    diagnosticCollection.clear()

    triggerValidate()
  })

  triggerValidate()

  return Disposable.from(...disposables)

  function triggerValidate() {
    workspace.textDocuments.forEach((doc) => validate(doc))
  }

  async function validate(doc: TextDocument) {
    const conf = getMatchedValidatorConfig(doc.uri)

    if (!conf) {
      return
    }

    const folderUri = workspace.getWorkspaceFolder(doc.uri)
    if (!folderUri) {
      return
    }

    const grammarContent = await workspace.fs.readFile(
      Uri.joinPath(folderUri.uri, conf.grammar),
    )

    const params: OhmValidateParams = {
      content: doc.getText(),
      grammar: new TextDecoder().decode(grammarContent),
    }

    const result = await client.sendRequest<OhmValidateResult | undefined>(
      OhmProtocolMethod.Validate,
      params,
    )

    if (result) {
      diagnosticCollection.set(
        doc.uri,
        result.errors.map((err) => {
          const range = convertRange(err.range)

          return new Diagnostic(
            range,
            err.message,
            err.severity ? err.severity - 1 : undefined,
          )
        }),
      )
    } else {
      diagnosticCollection.delete(doc.uri)
    }
  }
}

function getMatchedDocsByGrammar(uri: Uri) {
  const folderUri = workspace.getWorkspaceFolder(uri)
  if (!folderUri) {
    return
  }

  const configs = getConfig(ConfigKey.validator)?.filter((conf) => {
    const grammarUri = Uri.joinPath(folderUri.uri, conf.grammar)

    return grammarUri.toString() === uri.toString()
  })

  if (!configs?.length) {
    return
  }

  return workspace.textDocuments.filter((doc) => {
    return configs.some((conf) => picomatch.isMatch(doc.uri.fsPath, conf.match))
  })
}

function isOhmFile(uri: Uri) {
  return uri.scheme === 'file' && uri.path.endsWith('.ohm')
}

export function getMatchedValidatorConfig(uri: Uri) {
  if (uri.scheme !== 'file') {
    return
  }

  const configs = getConfig(ConfigKey.validator)

  return configs?.find((conf) => {
    return picomatch.isMatch(uri.fsPath, conf.match)
  })
}

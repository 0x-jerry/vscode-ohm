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
          const range = new Range(
            new Position(err.range.start.line, err.range.start.character),
            new Position(err.range.end.line, err.range.end.character),
          )

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

export function getMatchedValidatorConfig(uri: Uri) {
  if (uri.scheme !== 'file') {
    return
  }

  const configs = getConfig(ConfigKey.validator)

  return configs?.find((conf) => {
    return picomatch.isMatch(uri.fsPath, conf.match)
  })
}

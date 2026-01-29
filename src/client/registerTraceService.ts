import {
  Disposable,
  Hover,
  languages,
  Location,
  Uri,
  workspace,
  type CancellationToken,
  type Definition,
  type DefinitionLink,
  type DefinitionProvider,
  type DocumentFilter,
  type HoverProvider,
  type Position,
  type TextDocument,
} from 'vscode'
import type { BaseLanguageClient } from 'vscode-languageclient'
import {
  OhmProtocolMethod,
  type OhmTraceParams,
  type OhmTraceResult,
} from '../shared/OhmCustomProtocol'
import {
  getMatchedValidatorConfig,
  type ValidatorMatchConfig,
} from './registerValidatorService'
import { convertRange } from './utils'

class OhmHoverImpl implements HoverProvider {
  constructor(readonly client: BaseLanguageClient) {}

  async provideHover(
    doc: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | null | undefined> {
    const conf = getMatchedValidatorConfig(doc.uri)

    if (!conf) {
      return
    }

    const folderUri = workspace.getWorkspaceFolder(doc.uri)
    if (!folderUri) {
      return
    }

    const grammarUri = Uri.joinPath(folderUri.uri, conf.grammar)
    const grammarContent = await workspace.fs.readFile(grammarUri)

    const params: OhmTraceParams = {
      position: {
        line: position.line,
        character: position.character,
      },
      content: doc.getText(),
      grammar: new TextDecoder().decode(grammarContent),
    }

    const result = await this.client.sendRequest<OhmTraceResult | undefined>(
      OhmProtocolMethod.Trace,
      params,
      token,
    )

    if (!result) {
      return
    }

    const hover = new Hover(result.content, convertRange(result.range))

    return hover
  }
}

class OhmDefImpl implements DefinitionProvider {
  constructor(readonly client: BaseLanguageClient) {}

  async provideDefinition(
    doc: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | null | undefined> {
    const conf = getMatchedValidatorConfig(doc.uri)

    if (!conf) {
      return
    }

    const folderUri = workspace.getWorkspaceFolder(doc.uri)
    if (!folderUri) {
      return
    }

    const grammarUri = Uri.joinPath(folderUri.uri, conf.grammar)
    const grammarContent = await workspace.fs.readFile(grammarUri)

    const params: OhmTraceParams = {
      position: {
        line: position.line,
        character: position.character,
      },
      content: doc.getText(),
      grammar: new TextDecoder().decode(grammarContent),
    }

    const result = await this.client.sendRequest<OhmTraceResult | undefined>(
      OhmProtocolMethod.Trace,
      params,
      token,
    )

    if (!result) {
      return
    }

    const range = convertRange(result.grammarSourceRange)

    return new Location(grammarUri, range)
  }
}

export function registerTraceService(client: BaseLanguageClient) {
  const configs = workspace
    .getConfiguration('ohm-js')
    .get<ValidatorMatchConfig[]>('validator')

  if (!configs?.length) {
    return Disposable.from()
  }

  const selectors: DocumentFilter[] = configs.flatMap((conf) => {
    return conf.match.map((pattern) => {
      const selector: DocumentFilter = {
        scheme: 'file',
        pattern: pattern,
      }
      return selector
    })
  })

  const hover = languages.registerHoverProvider(
    selectors,
    new OhmHoverImpl(client),
  )

  const def = languages.registerDefinitionProvider(
    selectors,
    new OhmDefImpl(client),
  )

  return Disposable.from(hover, def)
}

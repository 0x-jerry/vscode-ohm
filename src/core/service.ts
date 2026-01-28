import {
  CompletionItem,
  CompletionItemKind,
  DocumentDiagnosticReportKind,
  Hover,
  SemanticTokensBuilder,
  TextDocumentSyncKind,
  TextEdit,
  WorkspaceEdit,
  type Connection,
  type Definition,
  type InitializeResult,
} from 'vscode-languageserver'
import { OhmLanguage, type LocationRule } from './OhmLanguage'
import { builtinRules } from './ohm'
import type { OhmAST } from './ast'
import type { IFilesystem } from '../common/FilesystemProtocol'

export interface ServiceOption {
  connection: Connection
  fs: IFilesystem
}

export function startService(opt: ServiceOption) {
  const { connection, fs } = opt

  const log = connection.console
  const ohm = new OhmLanguage({
    log,
    fs,
  })

  // https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
  const SemanticHighlight = {
    class: 0,
    interface: 1,
    namespace: 2,
  } as const

  // https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
  const SemanticModifier = {
    declaration: 1 << 0,
    definition: 2 << 1,
  } as const

  connection.onInitialize((_params) => {
    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: {
          change: TextDocumentSyncKind.Incremental,
        },
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        semanticTokensProvider: {
          documentSelector: [
            {
              language: 'ohm',
            },
          ],
          legend: {
            tokenTypes: Object.keys(SemanticHighlight),
            tokenModifiers: Object.keys(SemanticModifier),
          },
        },
        renameProvider: true,
        definitionProvider: true,
        hoverProvider: true,
        completionProvider: {
          resolveProvider: true,
        },
        diagnosticProvider: {
          interFileDependencies: false,
          workspaceDiagnostics: false,
        },
        workspace: {
          workspaceFolders: {
            supported: true,
          },
        },
      },
    }

    log.info('Ohm LSP Initialized!')
    return result
  })

  connection.languages.diagnostics.on(async (params) => {
    const uri = params.textDocument.uri

    const data = await ohm.getInternalData(uri)
    log.info(
      `request diagnostics: ${uri}, ${JSON.stringify(data.diagnostics, null, 2)}`,
    )

    if (data.diagnostics) {
      return data.diagnostics
    }

    return {
      kind: DocumentDiagnosticReportKind.Unchanged,
      resultId: Date.now().toString(),
    }
  })

  connection.languages.semanticTokens.on(async (params) => {
    const { textDocument } = params

    const ast = await ohm.getGrammar(textDocument.uri)

    const builder = new SemanticTokensBuilder()

    ast?.grammars.forEach((g) => {
      pushToken(g.ident, SemanticHighlight.class)

      if (g.super) {
        pushToken(g.super, SemanticHighlight.namespace)
      }

      g.rules.forEach((rule) => {
        pushToken(rule.name, SemanticHighlight.interface)
      })
    })

    return builder.build()

    function pushToken(
      token: OhmAST.Token,
      type: number,
      mod: number = SemanticModifier.declaration,
    ) {
      builder.push(
        token.range.start.line,
        token.range.start.character,
        token._source.length,
        type,
        mod,
      )
    }
  })

  connection.onDocumentSymbol((params) => {
    return ohm.getSymbols(params.textDocument.uri)
  })

  connection.onHover(async (params) => {
    const { position, textDocument } = params

    const word = await fs.getWordAtPosition(textDocument.uri, position)

    if (!word) {
      return null
    }

    const rules = await ohm.filterRules(textDocument.uri, {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    log.info(`hover: rules for ${word}: ${rules.length}`)

    const hover: Hover = {
      contents: [],
    }

    if (rules.length) {
      hover.contents = rules.map((rule) => {
        const desc = rule._source

        const ns = rule.root?.ident._source || '_'

        const mdStr = ['```ohm', `${ns} {`, '  ' + desc, '}', '```'].join('\n')

        return mdStr
      })

      return hover
    }

    const matchedBuiltinRule = builtinRules.find((n) => n.label === word)

    if (matchedBuiltinRule?.documentation) {
      hover.contents = matchedBuiltinRule.documentation
      return hover
    }

    return null
  })

  connection.onDefinition(async (params) => {
    const { textDocument, position } = params

    const word = fs.getWordAtPosition(textDocument.uri, position)

    if (!word) {
      return null
    }

    const rules = await ohm.filterRules(textDocument.uri, {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    log.info(`rules for ${word}: ${rules.length}`)

    if (rules.length) {
      return rules.map((rule) => {
        const def: Definition = {
          range: rule.range,
          uri: rule.uri,
        }

        return def
      })
    }

    return null
  })

  connection.onCompletion(async (params) => {
    const { textDocument } = params

    const rules = await ohm.filterRules(textDocument.uri)

    const completionItems = rules.map((rule) => {
      const item: CompletionItem = {
        label: rule._source,
        kind: CompletionItemKind.Interface,
        data: rule,
      }

      return item
    })

    const builtinCompletionItems = builtinRules.map((rule) => {
      const item: CompletionItem = {
        label: rule.label,
        kind: CompletionItemKind.Interface,
        documentation: rule.documentation,
      }

      return item
    })

    return [...completionItems, ...builtinCompletionItems]
  })

  connection.onCompletionResolve(async (item) => {
    const rule: LocationRule = item.data

    // Item.data may not be a location rule, check it first
    if (!rule?._source) {
      return item
    }

    const documentation = await fs.getTextByRange(rule.uri, rule.range)

    item.documentation = documentation

    return item
  })

  connection.onPrepareRename(async (params) => {
    const { textDocument, position } = params
    const uri = textDocument.uri

    const word = fs.getWordAtPosition(uri, position)

    const ast = await ohm.getGrammar(uri)
    if (!ast) return

    const rules = await ohm.filterRules(uri, {
      includeRefs: true,
      filter: (rule) => rule.name._source === word,
    })

    return rules.length > 0 ? fs.getWordRangeAtPosition(uri, position) : null
  })

  connection.onRenameRequest(async (params) => {
    const { textDocument, position, newName } = params
    const uri = textDocument.uri
    const word = fs.getWordAtPosition(uri, position)

    if (!word) {
      return null
    }

    const edit: WorkspaceEdit = {
      changes: {},
    }

    await ohm.filterRules(uri, {
      includeRefs: true,
      filter: (rule) => {
        if (rule.name._source === word) {
          const range = rule.name.range

          pushChange(rule.uri, {
            newText: newName,
            range,
          })
        }

        rule.body.forEach((seq) => {
          seq.terms.forEach((term) => {
            if (term._source === word) {
              const range = term.range

              pushChange(rule.uri, {
                newText: newName,
                range,
              })
            }
          })
        })

        return true
      },
    })

    return edit

    function pushChange(uri: string, change: TextEdit) {
      edit.changes ||= {}
      edit.changes[uri] ||= []
      edit.changes[uri].push(change)
    }
  })

  connection.listen()
}

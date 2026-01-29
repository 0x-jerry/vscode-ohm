import {
  CompletionItem,
  CompletionItemKind,
  DiagnosticSeverity,
  DocumentDiagnosticReportKind,
  Hover,
  Range,
  SemanticTokensBuilder,
  TextDocumentSyncKind,
  TextEdit,
  WorkspaceEdit,
  type Connection,
  type Definition,
  type InitializeResult,
} from 'vscode-languageserver'
import { OhmLanguage, type LocationRule } from './OhmLanguage'
import {
  builtinRules,
  traceMatchedContent,
  validateContent,
  visitTraceObject,
} from '../core/ohm'
import { type OhmAST } from '../core/ast'
import {
  OhmProtocolMethod,
  type OhmTraceParams,
  type OhmTraceResult,
  type OhmValidateParams,
  type OhmValidateResult,
} from '../shared/OhmCustomProtocol'
import { pexprs, type Interval } from 'ohm-js'
import { isInRange } from './utils'
import type { IFilesystem } from '../shared/FilesystemProtocol'
import { covertIntervalToRange } from '../core/utils'

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
          triggerCharacters: [' '],
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
    log.info(`receive completion request ${textDocument.uri}`)

    const rules = await ohm.filterRules(textDocument.uri)

    const completionItems = rules.map((rule) => {
      const item: CompletionItem = {
        label: rule.name._source,
        kind: CompletionItemKind.Interface,
        documentation: rule._source,
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

  connection.onRequest(
    OhmProtocolMethod.Validate,
    (params: OhmValidateParams) => {
      log.info(`receive validate task: ${params.content}`)
      //
      const error = validateContent(params.grammar, params.content)

      if (!error) {
        return
      }

      const info = error.interval

      const range = covertIntervalToRange(info)

      const result: OhmValidateResult = {
        errors: [
          {
            severity: DiagnosticSeverity.Error,
            range,
            message: error.shortMessage || error.message,
          },
        ],
      }

      return result
    },
  )

  connection.onRequest(OhmProtocolMethod.Trace, (params: OhmTraceParams) => {
    const traceResult = traceMatchedContent(params.grammar, params.content)

    log.info(`receive trace task: ${params.content}: ${!!traceResult}`)

    if (!traceResult) {
      return
    }

    const sourceIntervals: Interval[] = []
    let lastMatchContentRange: Range | null = null

    try {
      visitTraceObject(traceResult, (node, parent) => {
        const shouldSkip = { skip: true } as const
        if (!(node.expr instanceof pexprs.Apply)) {
          return
        }

        const range = covertIntervalToRange(node.source)

        const inRange = isInRange(range, params.position)

        if (!inRange) {
          return shouldSkip
        }

        if (node.expr.source) {
          const name = node.expr.toDisplayString()
          const rules = traceResult.grammar.rules

          // Exclude builtin rule
          if (Object.hasOwn(rules, name)) {
            sourceIntervals.push(rules[name].source)
          }
        }

        lastMatchContentRange = range
      })
    } catch (error) {
      const stack = (error as Error).stack
      log.error(`trace: ${String(error)}\n${stack}`)
    }

    if (!sourceIntervals.length || !lastMatchContentRange) {
      return
    }

    const finalSourceInterval = sourceIntervals.at(-1)!

    const result: OhmTraceResult = {
      grammarSourceRange: covertIntervalToRange(finalSourceInterval),
      content: finalSourceInterval.contents,
      range: lastMatchContentRange,
    }

    log.info(`trace result: ${JSON.stringify(result)}`)

    return result
  })

  connection.listen()
}

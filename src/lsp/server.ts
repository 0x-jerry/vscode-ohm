import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  FileChangeType,
  Hover,
  Position,
  ProposedFeatures,
  Range,
  SemanticTokensBuilder,
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit,
  WorkspaceEdit,
  type Definition,
  type InitializeResult,
} from 'vscode-languageserver/node'
import { OhmLanguage, type LocationRule } from '../core/OhmLanguage'
import { getWordAtPosition, getWordRangeAtPosition } from './DocumentHelper'
import { builtinRules } from '../core/ohm'
import type { OhmAST } from '../core/ast'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { IFilesystem } from '../core/types'
import { EventEmitter } from '@0x-jerry/utils'

const connection = createConnection(ProposedFeatures.all)
const log = connection.console

interface IFSEvents {
  changed: [uri: string]
  removed: [uri: string]
}

class IFS implements IFilesystem {
  documents = new TextDocuments(TextDocument)
  events = new EventEmitter<IFSEvents>()

  async readContent(uri: string): Promise<string | null> {
    const doc = this.documents.get(uri)
    if (doc) {
      return doc.getText()
    }

    return readFile(fileURLToPath(uri), 'utf8')
  }

  getWordAtPosition(uri: string, position: Position) {
    const doc = this.documents.get(uri)
    if (!doc) {
      return
    }

    return getWordAtPosition(doc, position)
  }

  getWordRangeAtPosition(uri: string, position: Position) {
    const doc = this.documents.get(uri)
    if (!doc) {
      return
    }

    return getWordRangeAtPosition(doc, position)
  }

  getTextRange(uri: string, range: Range) {
    return this.documents.get(uri)?.getText(range)
  }

  on(event: 'changed', callback: (uri: string) => void): void
  on(event: 'removed', callback: (uri: string) => void): void
  on(event: any, callback: any): void {
    this.events.on(event, callback)
  }
}

const fs = new IFS()

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
      textDocumentSync: TextDocumentSyncKind.Incremental,
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
  const data = await ohm.getInternalData(params.textDocument.uri)

  return data.diagnostics
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

  const word = fs.getWordAtPosition(textDocument.uri, position)

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

connection.onDidChangeWatchedFiles((evt) => {
  evt.changes.forEach((c) => {
    if (c.type === FileChangeType.Deleted) {
      fs.events.emit('removed', c.uri)
    } else if (c.type === FileChangeType.Changed) {
      fs.events.emit('changed', c.uri)
    }
  })
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

  const documentation = fs.getTextRange(rule.uri, rule.range)

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

// Start LSP server
fs.documents.listen(connection)
connection.listen()

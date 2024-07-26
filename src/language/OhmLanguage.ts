import {
  type TextDocument,
  languages,
  workspace,
  Uri,
  window,
  SemanticTokensLegend,
  Diagnostic,
  DiagnosticSeverity
} from 'vscode'
import { getNodeRange, parseAST, type OhmAST } from './ast'
import { DisposableImpl } from './DisposableImpl'
import { HoverProviderImpl } from './HoverPorviderImpl'
import { DefinitionProviderImpl } from './DefinitionProviderImpl'
import { DocumentSymbolProviderImpl } from './DocumentSymbolProviderImpl'
import { RenameProviderImpl } from './RenameProviderImpl'
import { CompletionItemProviderImpl } from './CompletionItemProviderImpl'
import { DocumentSemanticTokensProviderImpl } from './DocumentSemanticTokensProvider'
import type { MatchResult } from 'ohm-js'

export interface LocationRule extends OhmAST.Tokens.Rule {
  uri: Uri
}

export class OhmLanguage extends DisposableImpl {
  langSelector = 'ohm'

  #astMap = new Map<string, OhmAST.Tokens.Grammars>()

  #diagnosticCollection = languages.createDiagnosticCollection(
    this.langSelector
  )
  constructor() {
    super()

    const lang = this.langSelector
    const features = [
      languages.registerHoverProvider(lang, new HoverProviderImpl(this)),
      languages.registerDefinitionProvider(
        lang,
        new DefinitionProviderImpl(this)
      ),
      languages.registerDocumentSymbolProvider(
        this.langSelector,
        new DocumentSymbolProviderImpl(this)
      ),
      languages.registerRenameProvider(
        this.langSelector,
        new RenameProviderImpl(this)
      ),
      languages.registerCompletionItemProvider(
        this.langSelector,
        new CompletionItemProviderImpl(this)
      ),
      // languages.registerDocumentSemanticTokensProvider(
      //   this.langSelector,
      //   new DocumentSemanticTokensProviderImpl(this),
      //   DocumentSemanticTokensProviderImpl.legend
      // )
    ]

    this.subscribe(this.#diagnosticCollection)

    features.forEach((disposable) => this.subscribe(disposable))

    const currentDoc = window.activeTextEditor?.document

    if (currentDoc) {
      this.#updateAST(currentDoc)
    }

    this.subscribe(
      workspace.onDidOpenTextDocument((doc) => {
        this.#updateAST(doc)
      })
    )

    this.subscribe(
      workspace.onDidChangeTextDocument((changeEvt) => {
        const { document: doc, reason, contentChanges } = changeEvt

        this.#updateAST(doc, true)
      })
    )

    this.subscribe(
      workspace.onDidDeleteFiles((deleteEvt) => {
        deleteEvt.files.forEach((item) => {
          if (!this.#isOhmLang(item)) return

          this.#astMap.delete(item.toString())
        })
      })
    )
  }

  #isOhmLang(uri: Uri) {
    return uri.path.endsWith('.ohm')
  }

  #updateASTByContent(uri: Uri, content: string, force = false) {
    const uriString = uri.toString()
    if (!force && this.#astMap.has(uriString)) return

    try {
      const ast = parseAST(content)

      this.#diagnosticCollection.delete(uri)
      this.#astMap.set(uriString, ast)
      return ast
    } catch (error) {
      const err = error as MatchResult
      if (err.failed?.()) {
        const info = err.getInterval()

        const range = getNodeRange(info)

        const diagnostic = new Diagnostic(
          range,
          err.shortMessage || err.message || 'Unknown error',
          DiagnosticSeverity.Error
        )

        this.#diagnosticCollection.set(uri, [diagnostic])
      }
    }
  }

  async #updateAST(doc: TextDocument, force = false) {
    const uri = doc.uri

    if (!this.#isOhmLang(uri)) return

    const ast = this.#updateASTByContent(uri, doc.getText(), force)

    if (!ast) return

    const paths = this.#resolverSuperGrammars(ast).map((p) =>
      Uri.joinPath(uri, '..', p)
    )

    for (const refPath of paths) {
      if (this.#astMap.has(refPath.toString())) {
        continue
      }

      const content = await workspace.fs.readFile(refPath)

      this.#updateASTByContent(refPath, content.toString(), force)
    }
  }

  #resolverSuperGrammars(ast: OhmAST.Tokens.Grammars) {
    const refsPath = ast.grammars
      .filter((item) => item.super?.name != null)
      .map((item) => ast.ref[item.super!.name])
      .filter((n) => n != null)

    return refsPath
  }

  getGrammar(uri: Uri) {
    return this.#astMap.get(uri.toString())
  }

  filterRules(uri: Uri, predict?: (rule: LocationRule) => boolean) {
    const ast = this.#astMap.get(uri.toString())
    if (!ast) return []

    const rules: LocationRule[] = []

    ast.grammars.forEach((grammar) => {
      grammar.rules.forEach((rule) => {
        const _rule: LocationRule = {
          ...rule,
          uri
        }

        if (!predict || predict(_rule)) {
          rules.push(_rule)
        }
      })
    })

    const paths = Object.values(ast.ref).map((item) =>
      Uri.joinPath(uri, '..', item)
    )

    for (const ohmFilePath of paths) {
      const superGrammarRules = this.filterRules(ohmFilePath, predict)

      if (superGrammarRules) rules.push(...superGrammarRules)
    }

    return rules
  }
}

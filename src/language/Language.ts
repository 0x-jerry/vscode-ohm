import {
  Disposable,
  Position,
  type CancellationToken,
  type Definition,
  Hover,
  type DefinitionProvider,
  type HoverProvider,
  type LocationLink,
  type ProviderResult,
  type TextDocument,
  languages,
  workspace,
  Uri,
  Location,
  Range,
  window
} from 'vscode'
import { parseAST, type OhmAST } from './ast'

export class DisposableImpl implements Disposable {
  _subscribers = new Set<Disposable>()

  subscribe(t: Disposable) {
    this._subscribers.add(t)
  }

  dispose() {
    this._subscribers.forEach((item) => item.dispose())
  }
}

interface LocationRule extends OhmAST.Tokens.Rule {
  uri: Uri
}

export class OhmLanguage
  extends DisposableImpl
  implements DefinitionProvider, HoverProvider
{
  langSelector = 'ohm'

  _astMap = new Map<string, OhmAST.Tokens.Grammars>()

  constructor() {
    super()

    this.subscribe(languages.registerHoverProvider(this.langSelector, this))
    this.subscribe(
      languages.registerDefinitionProvider(this.langSelector, this)
    )

    const currentDoc = window.activeTextEditor?.document

    if (currentDoc) {
      this._updateAST(currentDoc)
    }

    this.subscribe(
      workspace.onDidOpenTextDocument((doc) => {
        this._updateAST(doc)
      })
    )

    this.subscribe(
      workspace.onDidChangeTextDocument((changeEvt) => {
        const { document: doc, reason, contentChanges } = changeEvt

        this._updateAST(doc, true)
      })
    )

    this.subscribe(
      workspace.onDidDeleteFiles((deleteEvt) => {
        deleteEvt.files.forEach((item) => {
          if (!this._isOhmLang(item)) return

          this._astMap.delete(item.toString())
        })
      })
    )
  }

  _isOhmLang(uri: Uri) {
    return uri.path.endsWith('.ohm')
  }

  _updateASTByContent(uri: Uri, content: string, force = false) {
    const uriString = uri.toString()
    if (!force && this._astMap.has(uriString)) return

    const ast = parseAST(content)

    if (!ast) {
      return
    }

    this._astMap.set(uriString, ast)

    return ast
  }

  async _updateAST(doc: TextDocument, force = false) {
    const uri = doc.uri

    if (!this._isOhmLang(uri)) return

    const ast = this._updateASTByContent(uri, doc.getText(), force)

    if (!ast) return

    const paths = this._resolverSuperGrammars(ast).map((p) =>
      Uri.joinPath(uri, '..', p)
    )

    for (const refPath of paths) {
      if (this._astMap.has(refPath.toString())) {
        continue
      }

      const content = await workspace.fs.readFile(refPath)

      this._updateASTByContent(refPath, content.toString(), force)
    }
  }

  _resolverSuperGrammars(ast: OhmAST.Tokens.Grammars) {
    const refsPath = ast.grammars
      .filter((item) => item.super?.name != null)
      .map((item) => ast.ref[item.super!.name])
      .filter((n) => n != null)

    return refsPath
  }

  _getRules(uri: Uri, word: string) {
    const ast = this._astMap.get(uri.toString())
    if (!ast) return

    const rules: LocationRule[] = []

    ast.grammars.forEach((g) => {
      g.rules.forEach((r) => {
        if (r.name._source === word) {
          rules.push({
            ...r,
            uri
          })
        }
      })
    })

    const paths = Object.values(ast.ref).map((item) =>
      Uri.joinPath(uri, '..', item)
    )

    for (const p of paths) {
      const _rules = this._getRules(p, word)

      if (_rules) rules.push(..._rules)
    }

    return rules
  }

  provideDefinition(
    doc: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Definition | LocationLink[]> {
    const wordRange = doc.getWordRangeAtPosition(position, /[\w\d_]+/)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = this._getRules(doc.uri, word) || []

    return rules.map((item) => {
      const start = new Position(
        item.location.lineNum - 1,
        item.location.colNum - 1
      )
      const end = new Position(
        item.location.lineNum - 1,
        item.location.colNum - 1 + item.name._source.length
      )

      const d = new Location(item.uri, new Range(start, end))
      return d
    })
  }

  provideHover(
    doc: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Hover> {
    const wordRange = doc.getWordRangeAtPosition(position, /[\w\d_]+/)
    const word = doc.getText(wordRange)

    if (!word) {
      return
    }

    const rules = this._getRules(doc.uri, word) || []

    const rule = rules.at(0)

    if (!rule) return

    const desc = rule._source

    const ns = rule.root?.ident._source || '_'

    const mdStr = ['```ohm', `${ns} {`, '  ' + desc, '}', '```'].join('\n')

    return new Hover(mdStr)
  }
}

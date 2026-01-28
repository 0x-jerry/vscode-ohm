import { getNodeRange, parseAST, type OhmAST } from '../core/ast'
import type { MatchResult } from 'ohm-js'
import {
  DiagnosticSeverity,
  DocumentDiagnosticReportKind,
  SymbolInformation,
  SymbolKind,
  type DocumentDiagnosticReport,
} from 'vscode-languageserver'
import { joinRelativeURL } from 'ufo'
import type { IFilesystem } from './types'

export interface LocationRule extends OhmAST.Tokens.Rule {
  uri: string
}

export interface OhmLanguageOptions {
  log: {
    log(message: string): void
    info(message: string): void
    warn(message: string): void
    error(message: string): void
  }

  fs: IFilesystem
}

interface InternalCacheData {
  uri: string
  content?: string
  ast?: OhmAST.Tokens.Grammars
  diagnostics: DocumentDiagnosticReport
}

export class OhmLanguage {
  documents: IFilesystem

  _astMap = new Map<string, InternalCacheData>()

  get log() {
    return this.opt.log
  }

  constructor(readonly opt: OhmLanguageOptions) {
    this.documents = opt.fs

    this.documents.on('changed', (uri) => {
      this._updateAST(uri)
    })

    this.documents.on('removed', (uri) => {
      this.removeByUri(uri)
    })
  }

  async getInternalData(uri: string, forceUpdate = false) {
    let data = this._astMap.get(uri)

    if (!data || forceUpdate) {
      const newData = await this._updateAST(uri)

      if (newData) {
        this._astMap.set(uri, newData)
      }
    }

    const defaultData: InternalCacheData = {
      uri,
      diagnostics: {
        kind: DocumentDiagnosticReportKind.Unchanged,
        resultId: Date.now().toString(),
      },
    }

    return data || defaultData
  }

  async _updateAST(uri: string): Promise<InternalCacheData | null> {
    const data: InternalCacheData = {
      uri,
      diagnostics: {
        kind: DocumentDiagnosticReportKind.Unchanged,
        resultId: Date.now().toString(),
      },
    }

    const content = await this._getFileContent(uri)

    if (!content) {
      this.log.warn(`Get file ${uri} content failed!`)

      return null
    }

    try {
      data.content = content
      data.ast = parseAST(content)
    } catch (error) {
      const err = error as MatchResult

      if (err.failed()) {
        const info = err.getInterval()

        const range = getNodeRange(info)

        data.diagnostics = {
          kind: DocumentDiagnosticReportKind.Full,
          items: [
            {
              severity: DiagnosticSeverity.Error,
              range,
              message: err.shortMessage || err.message || 'Unknown error',
            },
          ],
        }
      }
    }

    return data
  }

  async _getFileContent(uri: string): Promise<string | null> {
    return this.documents.readContent(uri)
  }

  async getSymbols(uri: string) {
    const rules = await this.filterRules(uri)

    return rules.map((rule) => {
      const s: SymbolInformation = {
        name: rule.name._source,
        kind: SymbolKind.Interface,
        containerName: rule.root?.ident._source,
        location: {
          uri: rule.uri,
          range: rule.name.range,
        },
      }
      return s
    })
  }

  /**
   *
   * @param ast
   * @returns Relative paths
   */
  _resolverSuperGrammars(ast: OhmAST.Tokens.Grammars) {
    const refsPath = ast.grammars
      .filter((item) => item.super?.name != null)
      .map((item) => ast.ref[item.super!.name])
      .filter((n) => n != null)

    return refsPath
  }

  async getGrammar(uri: string) {
    return (await this.getInternalData(uri)).ast
  }

  removeByUri(uri: string) {
    this._astMap.delete(uri)
  }

  async filterRules(
    uri: string,
    opt?: {
      filter?: (rule: LocationRule) => boolean
      includeRefs?: boolean
    },
  ) {
    const { filter, includeRefs } = opt || {}
    const data = await this.getInternalData(uri)
    if (!data.ast) return []

    const rules: LocationRule[] = []
    const ast = data.ast

    ast.grammars.forEach((grammar) => {
      grammar.rules.forEach((rule) => {
        const _rule: LocationRule = {
          ...rule,
          uri,
        }

        if (!filter || filter(_rule)) {
          rules.push(_rule)
        }
      })
    })

    if (includeRefs) {
      const paths = Object.values(ast.ref).map((item) =>
        joinRelativeURL(uri, '..', item),
      )

      for (const ohmFilePath of paths) {
        const superGrammarRules = await this.filterRules(ohmFilePath, opt)

        if (superGrammarRules) rules.push(...superGrammarRules)
      }
    }

    return rules
  }
}

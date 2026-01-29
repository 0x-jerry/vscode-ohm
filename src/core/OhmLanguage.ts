import { getNodeRange, parseAST, type OhmAST } from '../core/ast'
import {
  DiagnosticSeverity,
  DocumentDiagnosticReportKind,
  SymbolInformation,
  SymbolKind,
  type DocumentDiagnosticReport,
} from 'vscode-languageserver'
import { joinRelativeURL } from 'ufo'
import type { IFilesystem } from '../common/FilesystemProtocol'
import { isGrammarParseError } from './ohm'

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
  ast?: OhmAST.Tokens.Grammars
  diagnostics?: DocumentDiagnosticReport
}

export class OhmLanguage {
  documents: IFilesystem

  _internalData = new Map<string, Promise<InternalCacheData | undefined>>()

  get log() {
    return this.opt.log
  }

  constructor(readonly opt: OhmLanguageOptions) {
    this.documents = opt.fs

    this.documents.on('changed', (uri) => {
      this._updateCacheData(uri)
    })

    this.documents.on('deleted', (uri) => {
      this._internalData.delete(uri)
    })
  }

  _updateCacheData(uri: string) {
    this.log.info(`update cache data for: ${uri}`)
    const data = this._internalData.get(uri)
    const p = this._calcCacheData(uri, data)

    this._internalData.set(uri, p)
  }

  async _calcCacheData(
    uri: string,
    oldData?: Promise<InternalCacheData | undefined>,
  ) {
    const newData = await this._parseAST(uri)
    const _oldData = await oldData

    return newData || _oldData
  }

  async getInternalData(uri: string): Promise<InternalCacheData> {
    if (!this._internalData.has(uri)) {
      this._updateCacheData(uri)
    }

    const data = await this._internalData.get(uri)

    const defaultData: InternalCacheData = {
      uri,
    }

    return data || defaultData
  }

  async _parseAST(uri: string): Promise<InternalCacheData | null> {
    const data: InternalCacheData = {
      uri,
      diagnostics: {
        kind: DocumentDiagnosticReportKind.Full,
        items: [],
      },
    }

    const content = await this._getFileContent(uri)

    if (!content) {
      this.log.warn(`Get file ${uri} content failed!`)

      return null
    }

    try {
      data.ast = parseAST(content)

      this.log.info(`parse ast for ${uri} success! ${content}`)
    } catch (error) {
      if (isGrammarParseError(error)) {
        this.log.warn(`parse ast for ${uri} failed! ${String(error)}`)

        const info = error.interval

        const range = getNodeRange(info)

        data.diagnostics = {
          kind: DocumentDiagnosticReportKind.Full,
          items: [
            {
              severity: DiagnosticSeverity.Error,
              range,
              message: error.shortMessage || error.message,
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

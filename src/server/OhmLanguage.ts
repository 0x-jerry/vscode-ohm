import { OhmAST, parseAST } from '../core/ast'
import {
  Diagnostic,
  DiagnosticSeverity,
  SymbolInformation,
  SymbolKind,
} from 'vscode-languageserver'
import { joinRelativeURL } from 'ufo'
import { isGrammarParseError } from '../core/ohm'
import type { IFilesystem } from '../shared/FilesystemProtocol'
import { covertIntervalToRange } from '../core/utils'
import type { Awaitable } from '@0x-jerry/utils'

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

export interface InternalCacheData {
  uri: string
  ast?: OhmAST.Tokens.Grammars
  diagnostics: Diagnostic[]
  updatedAt: number
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
    this.log.info(`[ohm] Update cache data: ${uri}`)
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

    return data!
  }

  async _parseAST(uri: string): Promise<InternalCacheData | null> {
    const data: InternalCacheData = {
      uri,
      diagnostics: [],
      updatedAt: Date.now(),
    }

    const content = await this._getFileContent(uri)

    if (!content) {
      this.log.warn(`Get file ${uri} content failed!`)

      return null
    }

    try {
      data.ast = parseAST(content)
    } catch (error) {
      this.log.warn(`[ohm] Parse ast failed ${uri}: ${String(error)}`)

      if (isGrammarParseError(error)) {
        const info = error.interval

        const range = covertIntervalToRange(info)

        data.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range,
          message: error.shortMessage || error.message,
        })
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

    const rules: LocationRule[] = []

    await this.forEachRules(
      uri,
      (rule) => {
        if (!filter || filter(rule)) {
          rules.push(rule)
        }
      },
      {
        includeRefs,
      },
    )

    return rules
  }

  async forEachRules(
    uri: string,
    callback: (rule: LocationRule) => Promise<void> | void,
    opt?: {
      includeRefs?: boolean
    },
  ) {
    const data = await this.getInternalData(uri)
    const ast = data.ast

    if (!ast) return

    for (const grammar of ast.grammars) {
      for (const rule of grammar.rules) {
        const locRule: LocationRule = {
          ...rule,
          uri,
        }

        await callback(locRule)
      }
    }

    if (opt?.includeRefs) {
      const paths = Object.values(ast.ref).map((item) =>
        joinRelativeURL(uri, '..', item),
      )

      for (const ohmFileUri of paths) {
        await this.forEachRules(ohmFileUri, callback, opt)
      }
    }
  }

  async iterAllTerms(
    uri: string,
    callback: (token: OhmAST.Token) => Awaitable<void>,
  ) {
    await this.forEachRules(uri, async (rule) => {
      for (const body of rule.body) {
        await iterSeq(body)
      }
    })

    async function iterSeq(seq: OhmAST.Tokens.Seq) {
      for (const term of seq.terms) {
        if (term.type === OhmAST.Type.Seq) {
          await iterSeq(term)
          continue
        }

        if (term.type === OhmAST.Type.BaseApplication) {
          if (term.ident) {
            await callback(term.ident)
          }

          for (const param of term.params || []) {
            await iterSeq(param)
          }
          continue
        }

        await callback(term)
      }
    }
  }
}

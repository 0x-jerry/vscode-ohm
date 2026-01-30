import {
  DiagnosticSeverity,
  DocumentDiagnosticReportKind,
  type Connection,
  type DocumentDiagnosticReport,
  type FullDocumentDiagnosticReport,
  type ServerCapabilities,
  type UnchangedDocumentDiagnosticReport,
} from 'vscode-languageserver'
import type { FeatureContext } from './types'
import { builtinRules } from '../../core/ohm'
import type { InternalCacheData } from '../OhmLanguage'

export const diagnosticConfig: ServerCapabilities['diagnosticProvider'] = {
  workspaceDiagnostics: false,
  interFileDependencies: false,
}

const checkedAt = new WeakMap<InternalCacheData, number>()

export async function checkDiagnostics(
  uri: string,
  { ohm }: FeatureContext,
): Promise<DocumentDiagnosticReport> {
  const log = ohm.log

  log.info(`[f:diagnostics]: ${uri}`)

  const data = await ohm.getInternalData(uri)

  if (checkedAt.has(data) && checkedAt.get(data)! > data.updatedAt) {
    log.info(`[f:diagnostics]: ${uri} unchanged`)

    const diagnostics: UnchangedDocumentDiagnosticReport = {
      kind: DocumentDiagnosticReportKind.Unchanged,
      resultId: Date.now().toString(),
    }

    return diagnostics
  }

  const allTermNames = new Set<string>()

  const diagnostics: FullDocumentDiagnosticReport = {
    kind: DocumentDiagnosticReportKind.Full,
    resultId: Date.now().toString(),
    items: [...data.diagnostics],
  }

  await ohm.forEachRules(uri, async (rule) => {
    for (const body of rule.body) {
      for (const term of body.terms) {
        const termSource = term._source

        const isLiteralStr = (s: string) => s.startsWith('"') && s.endsWith('"')

        if (isLiteralStr(termSource)) {
          continue
        }

        allTermNames.add(termSource)

        if (!(await hasRule(uri, termSource))) {
          diagnostics.items.push({
            severity: DiagnosticSeverity.Warning,
            message: `Can not find rule ${termSource}!`,
            range: term.range,
          })
        }
      }
    }
  })

  const rules =
    data.ast?.grammars.flatMap((n) =>
      // The first rule is the entry
      // Do not need to check it
      n.rules.slice(1),
    ) || []

  const unusedRules = rules.filter((n) => !allTermNames.has(n.name._source))

  unusedRules.forEach((rule) => {
    diagnostics.items.push({
      severity: DiagnosticSeverity.Warning,
      range: rule.name.range,
      message: `${rule.name._source} is not used!`,
    })
  })

  log.info(`[f:diagnostics] Done`)
  checkedAt.set(data, Date.now())

  return diagnostics

  async function hasRule(uri: string, ruleName: string) {
    if (builtinRules.some((r) => r.label === ruleName)) {
      return true
    }
    let has = false
    await ohm.forEachRules(uri, (rule) => {
      if (rule.name._source === ruleName) {
        has = true
      }
    })

    return has
  }
}

export function registerDiagnostics(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  connection.languages.diagnostics.on(async (_) => {
    const diagnostics: UnchangedDocumentDiagnosticReport = {
      kind: DocumentDiagnosticReportKind.Unchanged,
      resultId: Date.now().toString(),
    }

    return diagnostics
  })

  fs.on('created', async (uri) => {
    const d = await checkDiagnostics(uri, { ohm, fs })
    if (d.kind === 'full') {
      await connection.sendDiagnostics({
        uri,
        diagnostics: d.items,
      })
    }
  })

  fs.on('changed', async (uri) => {
    const d = await checkDiagnostics(uri, { ohm, fs })
    if (d.kind === 'full') {
      await connection.sendDiagnostics({
        uri,
        diagnostics: d.items,
      })
    }
  })
}

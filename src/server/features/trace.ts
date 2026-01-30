import type { Connection, Range } from 'vscode-languageserver'
import type { FeatureContext } from './types'
import { type Interval, pexprs } from 'ohm-js'
import { traceMatchedContent, visitTraceObject } from '../../core/ohm'
import { covertIntervalToRange } from '../../core/utils'
import {
  OhmProtocolMethod,
  type OhmTraceParams,
  type OhmTraceResult,
} from '../../shared/OhmCustomProtocol'
import { isInRange } from '../utils'

export function registerTrace(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console

  connection.onRequest(OhmProtocolMethod.Trace, (params: OhmTraceParams) => {
    log.info(`[p:trace]`)

    const traceResult = traceMatchedContent(params.grammar, params.content)

    if (!traceResult) {
      return
    }

    const sourceIntervals: Interval[] = []
    let lastMatchContentRange: Range | null = null

    try {
      visitTraceObject(traceResult, (node, parent) => {
        if (!(node.expr instanceof pexprs.Apply)) {
          return
        }

        const range = covertIntervalToRange(node.source)

        const inRange = isInRange(range, params.position)

        if (!inRange) {
          return
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

    log.info(`[p:trace]: Result ${JSON.stringify(result)}`)

    return result
  })
}

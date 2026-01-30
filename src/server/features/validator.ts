import { DiagnosticSeverity, type Connection } from 'vscode-languageserver'
import type { FeatureContext } from './types'
import {
  OhmProtocolMethod,
  type OhmValidateParams,
  type OhmValidateResult,
} from '../../shared/OhmCustomProtocol'
import { validateContent } from '../../core/ohm'
import { covertIntervalToRange } from '../../core/utils'

export function registerValidator(
  connection: Connection,
  { ohm, fs }: FeatureContext,
) {
  const log = connection.console

  connection.onRequest(
    OhmProtocolMethod.Validate,
    (params: OhmValidateParams) => {
      log.info(`[p:validate]`)

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
}

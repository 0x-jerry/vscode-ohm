import type { Diagnostic } from 'vscode-languageserver'

export const OhmProtocolMethod = {
  Validate: 'ohm/validate',
} as const

export interface OhmValidateParams {
  /**
   * Grammar source string
   */
  grammar: string

  /**
   * Content that need to validate
   */
  content: string
}

export interface OhmValidateResult {
  errors: Diagnostic[]
}

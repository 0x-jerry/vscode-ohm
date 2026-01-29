import type { Diagnostic, Position, Range } from 'vscode-languageserver'

export const OhmProtocolMethod = {
  Validate: 'ohm/validate',
  Trace: 'ohm/trace',
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

export interface OhmTraceParams {
  /**
   * Grammar source string
   */
  grammar: string

  /**
   * Content that need to validate
   */
  content: string
  position: Position
}

export interface OhmTraceResult {
  grammarSourceRange: Range

  /**
   * Content range
   */
  range: Range
  /**
   * Markdown
   */
  content: string
  // errors: Diagnostic[]
}

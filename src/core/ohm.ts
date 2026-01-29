import {
  Alt,
  Apply,
  CaseInsensitiveTerminal,
  Extend,
  grammar,
  Iter,
  Lex,
  Lookahead,
  Not,
  Opt,
  Param,
  Plus,
  Range,
  Seq,
  Splice,
  Star,
  Terminal,
  UnicodeChar,
  type Interval,
  type IterationNode,
  type NonterminalNode,
  type TerminalNode,
} from 'ohm-js'

export interface BuiltinRule {
  label: string
  documentation?: string
}

/**
 * https://ohmjs.org/docs/syntax-reference#built-in-rules
 *
 * https://github.com/ohmjs/ohm/blob/cb3decc0b8d8c6300b7f591f13d5219314a0e3c0/packages/ohm-js/src/built-in-rules.ohm
 *
 */
export const builtinRules: BuiltinRule[] = [
  {
    label: 'letter',
    documentation:
      'Matches a single character which is a letter (either uppercase or lowercase).',
  },
  {
    label: 'lower',
    documentation: 'Matches a single lowercase letter.',
  },
  {
    label: 'upper',
    documentation: 'Matches a single uppercase letter.',
  },
  {
    label: 'digit',
    documentation: 'Matches a single character which is a digit from 0 to 9.',
  },
  {
    label: 'hexDigit',
    documentation:
      'Matches a single character which is a either digit or a letter from A-F.',
  },
  {
    label: 'alnum',
    documentation:
      'Matches a single letter or digit; equivalent to `letter | digit`.',
  },
  {
    label: 'space',
    documentation:
      'Matches a single whitespace character (e.g., space, tab, newline, etc.)',
  },
  {
    label: 'end',
    documentation: 'Matches the end of the input stream. Equivalent to ~any.',
  },
  {
    label: 'ListOf',
  },
  {
    label: 'EmptyListOf',
  },
  {
    label: 'NonemptyListOf',
  },
  {
    label: 'listOf',
  },
  {
    label: 'emptyListOf',
  },
  {
    label: 'nonemptyListOf',
  },
  {
    label: 'applySyntactic',
  },
  {
    label: 'caseInsensitive',
  },
]

export interface GrammarParseError extends Error {
  shortMessage: string
  interval: Interval
}

export function isGrammarParseError(err: unknown): err is GrammarParseError {
  return err instanceof Error && 'interval' in err
}

export function validateContent(grammarSource: string, content: string) {
  const g = grammar(grammarSource)

  const result = g.match(content)

  if (result.failed()) {
    const error = new Error(result.message) as GrammarParseError

    error.interval = result.getInterval()
    error.shortMessage = result.shortMessage

    return error
  }
}

export function traceMatchedContent(grammarSource: string, content: string) {
  const g = grammar(grammarSource)

  const traceObject = g.trace(content)

  return Object.assign(traceObject as OhmTraceObject, {
    grammar: g,
  })
}

/**
 * https://github.com/ohmjs/ohm/blob/1895b4e42da2528872b406288d44f8e354411944/packages/ohm-js/src/Trace.js
 */
export interface OhmTraceObject {
  input: string
  source: Interval
  children: (OhmTraceObject | undefined)[]
  expr: OhmExpr & { source?: Interval }
  bindings: OhmBinding[]

  readonly isRootNode: boolean
  readonly succeeded: boolean
}

type OhmBinding = TerminalNode | NonterminalNode | IterationNode

type OhmExpr =
  | Terminal
  | Range
  | Param
  | Alt
  | Extend
  | Splice
  | Seq
  | Iter
  | Star
  | Plus
  | Opt
  | Not
  | Lookahead
  | Lex
  | Apply
  | UnicodeChar
  | CaseInsensitiveTerminal

export function visitTraceObject(
  currentNode: OhmTraceObject,
  cb: (
    o: OhmTraceObject,
    parent?: OhmTraceObject,
  ) => void | { skip: true },
  parent?: OhmTraceObject,
) {
  const r = cb(currentNode, parent)

  if (r?.skip) {
    return
  }

  for (const node of currentNode.children) {
    if (node) {
      visitTraceObject(node, cb, currentNode)
    }
  }
}

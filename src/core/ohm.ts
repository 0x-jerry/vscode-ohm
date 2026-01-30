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
 * https://github.com/ohmjs/ohmjs.org/blob/1a1ae6160dca2a87300c45c103721abe24048856/docs/syntax-reference.md#built-in-rules
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
    label: 'spaces',
    documentation:
      'Matches multiple whitespace characters (e.g., space, tab, newline, etc.)',
  },
  {
    label: 'end',
    documentation: 'Matches the end of the input stream. Equivalent to ~any.',
  },
  {
    label: 'caseInsensitive',
    documentation: "Matches _terminal_, but ignoring any differences in casing (based on the simple, single-character Unicode case mappings)"
  },
  {
    label: 'ListOf',
    documentation: "Matches the expression _elem_ zero or more times, separated by something that matches the expression _sep_."
  },
  {
    label: 'NonemptyListOf',
    documentation: "Like `ListOf`, but matches _elem_ at least one time."
  },
  {
    label: 'listOf',
    documentation: "Similar to `ListOf<elem, sep>` but interpreted as lexical rule."
  },
  {
    label: 'EmptyListOf',
  },
  {
    label: 'emptyListOf',
  },
  {
    label: 'nonemptyListOf',
  },
  {
    label: 'applySyntactic',
    documentation: " Allows the syntactic rule _ruleName_ to be applied in a lexical context, which is otherwise not allowed. Spaces are skipped _before_ and _after_ the rule application. _New in Ohm v16.1.0._"
  },
  {
    label: "unicodeChar",
    documentation: "matches a single Unicode code point from a given category, or with a given binary property."
  },
  {
    label: 'any',
    documentation: "Matches the next Unicode character — i.e., a single code point — in the input stream, if one exists."
  },
  {
    label: 'unicodeLtmo',
    // https://github.com/ohmjs/ohm/blob/1895b4e42da2528872b406288d44f8e354411944/packages/ohm-js/src/Grammar.js#L352-L358
    documentation: "Union of Lt (titlecase), Lm (modifier), and Lo (other), i.e. any letter not in Ll or Lu."
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

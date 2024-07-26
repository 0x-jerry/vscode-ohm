import { toAST } from 'ohm-js/extras'
import {
  ohmGrammar,
  type Interval,
  type LineAndColumnInfo,
  type Node
} from 'ohm-js'
import type { OhmActionDict } from '../grammar/ohm-grammar.ohm-bundle'
import { Position, Range } from 'vscode'

export namespace OhmAST {
  export enum Type {
    Grammars,
    Grammar,
    SuperGrammar,
    Rule,
    RuleBody,
    TopLevelTerm,
    OverrideRuleBody,
    OverrideTopLevelTerm,
    Formals,
    Params,
    Alt,
    Seq,
    Iter,
    Pred,
    Lex,
    Base,
    ruleDescr,
    ruleDescrText,
    caseName,
    name,
    nameFirst,
    nameRest,
    ident,
    terminal,
    oneCharTerminal,
    terminalChar,
    escapeChar,
    space,
    comment,
    tokens,
    token,
    operator,
    punctuation
  }

  export interface Location extends LineAndColumnInfo {}

  export interface Token {
    type: Type
    range: Range
    _source: string
  }

  export namespace Tokens {
    export interface Grammars extends Token {
      type: Type.Grammars
      grammars: Grammar[]
      ref: Record<string, string>
    }

    export interface Grammar extends Token {
      type: Type.Grammar
      ident: Token
      rules: Rule[]
      super?: SuperGrammar
    }

    export interface SuperGrammar extends Token {
      type: Type.SuperGrammar
      name: string
    }

    export interface Rule extends Token {
      type: Type.Rule
      name: Token
      formals: Formals[]
      desc: string
      body: Seq[]
      root?: Grammar
    }

    export interface Seq extends Token {
      type: Type.Seq
      terms: Term[]
    }

    export interface Term extends Token {
      type: Type.Base
      ident?: Token
      params?: Seq[]
    }

    export interface Formals extends Token {
      type: Type.Formals
      idents: string[]
    }

    export type All =
      | Grammars
      | Grammar
      | Rule
      | Seq
      | Term
      | Formals
      | SuperGrammar

    export type GetTokenByType<T, U extends All = All> = U extends { type: T }
      ? U
      : never
  }
}

//  ----------

export function getNodeRange(node: Interval): Range {
  const location = node.getLineAndColumn()
  const source = node.sourceString

  const start = new Position(location.lineNum - 1, location.colNum - 1)

  const end = new Position(
    location.lineNum - 1,
    location.colNum - 1 + source.length
  )

  return new Range(start, end)
}

function createToken<T extends OhmAST.Type>(
  t: Node,
  type: T
): OhmAST.Tokens.GetTokenByType<T> {
  const _t: OhmAST.Token = {
    type,
    range: getNodeRange(t.source),
    _source: t.sourceString
  }

  return _t as any
}

declare module 'ohm-js' {
  interface Node {
    toAST(mapping: any): any
  }
}

const astMapping: OhmActionDict<OhmAST.Tokens.All> = {
  Grammars(grammars) {
    const t = createToken(this, OhmAST.Type.Grammars)
    t.grammars = grammars.toAST({})
    t.ref = {}

    return t
  },
  Grammar(name, _super, _, rules, _1) {
    const t = createToken(this, OhmAST.Type.Grammar)

    const ctx: GrammarContext = {
      root: t
    }

    t.ident = name.toAST({})

    t.rules = rules.toAST({
      grammar: ctx
    })

    t.super = _super.toAST({})

    return t
  },
  SuperGrammar(_, name) {
    const t = createToken(this, OhmAST.Type.SuperGrammar)
    t.name = name.sourceString
    return t
  },
  Rule(inner) {
    return inner.toAST(getParameters(this))
  },
  Rule_define(ident, formals, desc, _, body) {
    const t = createToken(this, OhmAST.Type.Rule)
    const ctx = getGrammarContext(this)
    t.root = ctx?.root

    t.formals = formals.toAST({})
    t.body = body.toAST({})

    t.name = ident.toAST({})
    t.desc = desc.sourceString

    return t
  },
  Rule_extend(ident, formals, _, body) {
    const t = createToken(this, OhmAST.Type.Rule)
    const ctx = getGrammarContext(this)
    t.root = ctx?.root

    t.formals = formals.toAST({})
    t.body = body.toAST({})

    t.name = ident.toAST({})

    return t
  },
  Rule_override(ident, formals, _, body) {
    const t = createToken(this, OhmAST.Type.Rule)
    const ctx = getGrammarContext(this)
    t.root = ctx?.root

    t.formals = formals.toAST({})
    t.body = body.toAST({})

    t.name = ident.toAST({})

    return t
  },
  Formals(arg0, terms, arg2) {
    const t = createToken(this, OhmAST.Type.Formals)
    t.idents = terms.asIteration().children.map((item) => item.sourceString)
    return t
  },
  RuleBody(arg0, terms) {
    return terms.toAST(astMapping)
  },
  OverrideRuleBody(arg0, terms) {
    return terms.toAST(astMapping)
  },
  OverrideTopLevelTerm(arg0) {
    return arg0.toAST(astMapping)
  },
  OverrideTopLevelTerm_superSplice(arg0) {
    // todo, use another type of token
    const t = createToken(this, OhmAST.Type.Seq)
    t.terms = []
    return t
  },
  TopLevelTerm(seq) {
    return seq.toAST(astMapping)
  },
  TopLevelTerm_inline(seq, _) {
    return seq.toAST(astMapping)
  },
  Seq(iters) {
    const t = createToken(this, OhmAST.Type.Seq)
    t.terms = iters.toAST(astMapping)

    return t
  },
  Iter(pred) {
    return pred.toAST(astMapping)
  },
  Iter_opt(pred, arg1) {
    return pred.toAST(astMapping)
  },
  Iter_plus(pred, arg1) {
    return pred.toAST(astMapping)
  },
  Iter_star(pred, arg1) {
    return pred.toAST(astMapping)
  },
  Pred(lex) {
    return lex.toAST(astMapping)
  },
  Pred_lookahead(arg0, lex) {
    return lex.toAST(astMapping)
  },
  Pred_not(arg0, lex) {
    return lex.toAST(astMapping)
  },
  Lex(base) {
    return base.toAST(astMapping)
  },
  Lex_lex(_, base) {
    return base.toAST(astMapping)
  },
  Base(inner) {
    return inner.toAST(astMapping)
  },
  Base_application(ident, _) {
    const t = createToken(this, OhmAST.Type.Base)
    t.ident = ident.toAST({ a: 1 })

    return t
  },
  Base_paren(arg0, arg1, arg2) {
    return createToken(this, OhmAST.Type.Base)
  },
  Base_range(arg0, arg1, arg2) {
    return createToken(this, OhmAST.Type.Base)
  },
  Base_terminal(arg0) {
    return createToken(this, OhmAST.Type.Base)
  },
  ident(name) {
    return createToken(this, OhmAST.Type.ident)
  }
}

interface GrammarContext {
  root: OhmAST.Tokens.Grammar
}

function getGrammarContext(node: Node): GrammarContext | undefined {
  return getParameters(node)?.grammar
}

function getParameters(node: Node) {
  return node.args.mapping
}

const REF_RE = /\/\/\s+@(?<name>[\w\d_]+)\s*=>\s*(?<path>.+)$/gm
const SINGLE_REF_RE = /\/\/\s+@(?<name>[\w\d_]+)\s*=>\s*(?<path>.+)$/

export function parseAST(s: string) {
  const result = ohmGrammar.match(s)
  if (result.failed()) {
    throw result
  }

  const ast = toAST(result, astMapping) as OhmAST.Tokens.Grammars

  const refResults = s.match(REF_RE)

  if (refResults) {
    refResults.forEach((item) => {
      const r = item.match(SINGLE_REF_RE)
      if (r?.groups) {
        const { name, path } = r.groups
        ast.ref[name] = path
      }
    })
  }

  return ast
}

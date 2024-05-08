import { toAST } from "ohm-js/extras";
import {
  grammars,
  ohmGrammar,
  type Interval,
  type LineAndColumnInfo,
  type Node,
} from "ohm-js";
import type { OhmActionDict } from "./ohm-grammar.ohm-bundle";

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
    punctuation,
  }

  export interface Location extends LineAndColumnInfo {}

  export interface Token {
    type: Type;
    location: Location;
    _source: string;
  }

  export namespace Tokens {
    export interface Grammars extends Token {
      type: Type.Grammars;
      grammars: Grammar[];
      ref: Record<string, string>;
    }

    export interface Grammar extends Token {
      type: Type.Grammar;
      ident: string;
      rules: Rule[];
      super?: SuperGrammar;
    }

    export interface SuperGrammar extends Token {
      type: Type.SuperGrammar;
      name: string;
    }

    export interface Rule extends Token {
      type: Type.Rule;
      name: string;
      formals: Formals[];
      desc: string;
      body: Seq[];
    }

    export interface Seq extends Token {
      type: Type.Seq;
      terms: Term[];
    }

    export interface Term extends Token {
      type: Type.Base;
      ident?: string;
      params?: Seq[];
    }

    export interface Formals extends Token {
      type: Type.Formals;
      idents: string[];
    }

    export type All =
      | Grammars
      | Grammar
      | Rule
      | Seq
      | Term
      | Formals
      | SuperGrammar;

    export type GetTokenByType<T, U extends All = All> = U extends { type: T }
      ? U
      : never;
  }
}

//  ----------

function nodeLocationInfo(source: Interval) {
  const info = source.getLineAndColumn();

  return info;
}

function createToken<T extends OhmAST.Type>(
  t: Node,
  type: T
): OhmAST.Tokens.GetTokenByType<T> {
  const _t: OhmAST.Token = {
    type,
    location: nodeLocationInfo(t.source),
    _source: t.sourceString,
  };

  return _t as any;
}

declare module "ohm-js" {
  interface Node {
    toAST(mapping: any): any;
  }
}

const astMapping: OhmActionDict<OhmAST.Tokens.All> = {
  Grammars(grammars) {
    const t = createToken(this, OhmAST.Type.Grammars);
    t.grammars = grammars.toAST(astMapping);
    t.ref = {};

    return t;
  },
  Grammar(name, _super, _, rules, _1) {
    const t = createToken(this, OhmAST.Type.Grammar);
    t.ident = name.sourceString;
    t.rules = rules.toAST(astMapping);
    t.super = _super.toAST({});

    return t;
  },
  SuperGrammar(_, name) {
    const t = createToken(this, OhmAST.Type.SuperGrammar);
    t.name = name.sourceString;
    return t;
  },
  Rule(inner) {
    return inner.toAST(astMapping);
  },
  Rule_define(ident, formals, desc, _, body) {
    const t = createToken(this, OhmAST.Type.Rule);
    t.formals = formals.toAST(astMapping);
    t.body = body.toAST(astMapping);

    t.name = ident.sourceString;
    t.desc = desc.sourceString;

    return t;
  },
  Rule_extend(ident, formals, _, body) {
    const t = createToken(this, OhmAST.Type.Rule);
    t.formals = formals.toAST(astMapping);
    t.body = body.toAST(astMapping);

    t.name = ident.sourceString;

    return t;
  },
  Rule_override(ident, formals, _, body) {
    const t = createToken(this, OhmAST.Type.Rule);
    t.formals = formals.toAST(astMapping);
    t.body = body.toAST(astMapping);

    t.name = ident.sourceString;

    return t;
  },
  Formals(arg0, iterms, arg2) {
    const t = createToken(this, OhmAST.Type.Formals);
    t.idents = iterms.asIteration().children.map((item) => item.sourceString);
    return t;
  },
  RuleBody(arg0, terms) {
    return terms.toAST(astMapping);
  },
  TopLevelTerm(seq) {
    return seq.toAST(astMapping);
  },
  TopLevelTerm_inline(seq, _) {
    return seq.toAST(astMapping);
  },
  Seq(iters) {
    const t = createToken(this, OhmAST.Type.Seq);
    t.terms = iters.toAST(astMapping);

    return t;
  },
  Iter(pred) {
    return pred.toAST(astMapping);
  },
  Iter_opt(pred, arg1) {
    return pred.toAST(astMapping);
  },
  Iter_plus(pred, arg1) {
    return pred.toAST(astMapping);
  },
  Iter_star(pred, arg1) {
    return pred.toAST(astMapping);
  },
  Pred(lex) {
    return lex.toAST(astMapping);
  },
  Pred_lookahead(arg0, lex) {
    return lex.toAST(astMapping);
  },
  Pred_not(arg0, lex) {
    return lex.toAST(astMapping);
  },
  Lex(base) {
    return base.toAST(astMapping);
  },
  Lex_lex(_, base) {
    return base.toAST(astMapping);
  },
  Base(inner) {
    return inner.toAST(astMapping);
  },
  Base_application(ident, _) {
    const t = createToken(this, OhmAST.Type.Base);
    t.ident = ident.sourceString;

    return t;
  },
  Base_paren(arg0, arg1, arg2) {
    return createToken(this, OhmAST.Type.Base);
  },
  Base_range(arg0, arg1, arg2) {
    return createToken(this, OhmAST.Type.Base);
  },
  Base_terminal(arg0) {
    return createToken(this, OhmAST.Type.Base);
  },
};

const REF_RE = /\/\/\s+@(?<name>[\w\d_]+)\s*=>\s*(?<path>.+)$/gm;

export function parseAST(s: string) {
  try {
    const t = ohmGrammar.match(s);

    const ast = toAST(t, astMapping) as OhmAST.Tokens.Grammars;

    const refResults = s.match(REF_RE);

    if (refResults) {
      refResults.forEach((item) => {
        const SINGLE_REF_RE = /\/\/\s+@(?<name>[\w\d_]+)\s*=>\s*(?<path>.+)$/;
        const r = item.match(SINGLE_REF_RE);
        if (r?.groups) {
          const { name, path } = r.groups;
          ast.ref[name] = path;
        }
      });
    }

    return ast;
  } catch (error) {
    console.error(error);
  }
}

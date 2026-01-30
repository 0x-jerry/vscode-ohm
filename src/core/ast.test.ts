import { parseAST } from './ast'
import { traceMatchedContent } from './ohm'

describe('#ast', () => {
  it('should failed', () => {
    const compile = () => {
      const ast = parseAST(`
Silver {
    Hello = f
    f = letter ListOf<a, "|">
    f f2
}
`)

      console.log(ast)
    }

    expect(compile).to.throw()
  })

  it('test trace', () => {
    const mathGrammar = `
Arithmetic {
  Exp
    = AddExp

  AddExp
    = AddExp "+" MulExp  -- plus
    | AddExp "-" MulExp  -- minus
    | MulExp

  MulExp
    = MulExp "*" ExpExp  -- times
    | MulExp "/" ExpExp  -- divide
    | ExpExp

  ExpExp
    = PriExp "^" ExpExp  -- power
    | PriExp

  PriExp
    = "(" Exp ")"  -- paren
    | "+" PriExp   -- pos
    | "-" PriExp   -- neg
    | ident
    | number

  ident  (an identifier)
    = letter alnum*

  number  (a number)
    = digit* "." digit+  -- fract
    | digit+             -- whole
}

      `
    const content = `2 * (42 - 1) / 9`

    const result = traceMatchedContent(mathGrammar, content)

    console.log(result)
  })
})

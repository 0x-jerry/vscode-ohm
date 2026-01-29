import { grammar, ohmGrammar } from 'ohm-js'
import { covertIntervalToRange, parseAST } from './ast'
import { traceMatchedContent, visitTraceObject } from './ohm'
import { isInRange } from '../server/utils'

describe('#ast', () => {
  it.skip('should failed', () => {
    const compile = () =>
      parseAST(`
Silver {
    Hello = f
    f = letter
    f f2
}
`)

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

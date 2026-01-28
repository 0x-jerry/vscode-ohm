import { parseAST } from './ast'

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
})

import { Position, Range } from 'vscode'
import type { OhmAST } from './ast'

export function locationToRange(token: OhmAST.Token): Range {
  const start = new Position(
    token.location.lineNum - 1,
    token.location.colNum - 1,
  )

  const end = new Position(
    token.location.lineNum - 1,
    token.location.colNum - 1 + token._source.length,
  )

  return new Range(start, end)
}

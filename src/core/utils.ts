import type { Interval } from "ohm-js"
import type { Position, Range } from "vscode-languageserver-textdocument"

export function covertIntervalToRange(node: Interval): Range {
  const location = node.getLineAndColumn()
  const source = node.contents

  const start: Position = {
    line: location.lineNum - 1,
    character: location.colNum - 1,
  }

  const end: Position = {
    line: location.lineNum - 1,
    character: location.colNum - 1 + source.length,
  }

  const range: Range = {
    start,
    end,
  }

  return range
}

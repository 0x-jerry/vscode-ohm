import type {
  Range as Range1,
  Position as Position1,
} from 'vscode-languageserver'
import { Position, Range } from 'vscode'

export function toRange(range: Range1): Range {
  return new Range(toPosition(range.start), toPosition(range.end))
}

export function toPosition(position: Position1): Position {
  return new Position(position.line, position.character)
}


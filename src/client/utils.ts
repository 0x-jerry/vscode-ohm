import type {
  Position as LPosition,
  Range as LRange,
} from 'vscode-languageserver'
import { Position, Range } from 'vscode'

export function convertPosition(position: LPosition): Position {
  return new Position(position.line, position.character)
}

export function convertRange(range: LRange): Range {
  return new Range(convertPosition(range.start), convertPosition(range.end))
}


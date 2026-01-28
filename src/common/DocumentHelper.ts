import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Position, Range } from 'vscode-languageserver'

export function getWordRangeAtPosition(
  document: TextDocument,
  position: Position,
) {
  const text = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  })

  const col = position.character
  const isWordChar = (c: string | undefined) => (c ? /[\w\d_]/.test(c) : false)

  if (isWordChar(text[col])) {
    let start = col
    while (start > 0 && isWordChar(text[start - 1])) start--
    let end = col
    while (end < text.length && isWordChar(text[end])) end++

    return Range.create(
      Position.create(position.line, start),
      Position.create(position.line, end),
    )
  }

  if (col > 0 && isWordChar(text[col - 1])) {
    let start = col - 1
    while (start > 0 && isWordChar(text[start - 1])) start--

    return Range.create(
      Position.create(position.line, start),
      Position.create(position.line, col),
    )
  }

  return null
}

export function getWordAtPosition(
  document: TextDocument,
  position: Position,
): string | null {
  const text = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  })

  const col = position.character
  const isWordChar = (c: string | undefined) => (c ? /[\w\d_]/.test(c) : false)

  if (isWordChar(text[col])) {
    let start = col
    while (start > 0 && isWordChar(text[start - 1])) start--
    let end = col
    while (end < text.length && isWordChar(text[end])) end++
    return text.slice(start, end)
  }

  if (col > 0 && isWordChar(text[col - 1])) {
    let start = col - 1
    while (start > 0 && isWordChar(text[start - 1])) start--
    return text.slice(start, col)
  }

  return null
}

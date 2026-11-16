"""Display tokens and the lines they fall on.

The same two functions exist in the web app (src/steer/layout.ts) and must
agree: the server scores lines, the client draws them. tests/fixtures/layout.json
is checked by both.
"""

from __future__ import annotations

import re

#: a run of newlines, or a word with the spaces in front of it
_PIECE = re.compile(r"\n+|[^\S\n]*[^\s]+|[^\S\n]+(?=\n|$)")


def split(text: str) -> list[str]:
    """Cut text into display tokens. Joining them gives the text back."""
    return _PIECE.findall(text)


class StreamSplitter:
    """`split` for text that arrives in pieces.

    A piece is only complete once the next one starts, so the last one is held
    back until more text arrives or the stream ends.
    """

    def __init__(self) -> None:
        self._buf = ""

    def feed(self, delta: str) -> list[str]:
        self._buf += delta
        pieces = split(self._buf)
        if len(pieces) <= 1:
            return []
        ready, self._buf = pieces[:-1], pieces[-1]
        return ready

    def flush(self) -> list[str]:
        pieces, self._buf = split(self._buf), ""
        return pieces


def wrap(tokens: list[str], cols: int) -> list[int]:
    """The visual line each token is on, wrapping at `cols` characters.

    A newline token belongs to the line it ends. A word that would cross the
    edge moves to the next line and loses the spaces in front of it.
    """
    lines: list[int] = []
    line = 0
    col = 0
    for tok in tokens:
        if tok.startswith("\n"):
            lines.append(line)
            line += len(tok)
            col = 0
            continue
        width = len(tok)
        if col > 0 and col + width > cols:
            line += 1
            col = 0
        if col == 0:
            width = len(tok.lstrip(" \t"))
        lines.append(line)
        col += width
    return lines


def line_count(tokens: list[str], cols: int) -> int:
    if not tokens:
        return 0
    lines = wrap(tokens, cols)
    last = tokens[-1]
    return lines[-1] + 1 + (len(last) - 1 if last.startswith("\n") else 0)


def paragraphs(tokens: list[str]) -> int:
    count, open_ = 0, False
    for tok in tokens:
        if tok.startswith("\n"):
            if len(tok) > 1:
                open_ = False
        elif not open_:
            open_ = True
            count += 1
    return count

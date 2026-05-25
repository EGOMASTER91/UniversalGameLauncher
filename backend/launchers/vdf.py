"""Minimal Valve KeyValue (VDF) parser. Handles the appmanifest_*.acf format used by Steam."""
from __future__ import annotations


def parse(text: str) -> dict:
    tokens: list[str] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if c == '"':
            i += 1
            start = i
            buf: list[str] = []
            while i < n and text[i] != '"':
                if text[i] == "\\" and i + 1 < n:
                    nxt = text[i + 1]
                    buf.append({"n": "\n", "t": "\t", "\\": "\\", '"': '"'}.get(nxt, nxt))
                    i += 2
                else:
                    buf.append(text[i])
                    i += 1
            tokens.append("".join(buf))
            i += 1
            continue
        if c in "{}":
            tokens.append(c)
            i += 1
            continue
        start = i
        while i < n and not text[i].isspace() and text[i] not in "{}":
            i += 1
        tokens.append(text[start:i])

    pos = [0]

    def parse_obj() -> dict:
        obj: dict = {}
        while pos[0] < len(tokens) and tokens[pos[0]] != "}":
            key = tokens[pos[0]]
            pos[0] += 1
            if pos[0] >= len(tokens):
                break
            tok = tokens[pos[0]]
            if tok == "{":
                pos[0] += 1
                obj[key] = parse_obj()
                if pos[0] < len(tokens) and tokens[pos[0]] == "}":
                    pos[0] += 1
            else:
                obj[key] = tok
                pos[0] += 1
        return obj

    return parse_obj()

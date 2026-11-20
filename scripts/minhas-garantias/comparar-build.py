#!/usr/bin/env python3
"""Compara dois `vite build` (antes x depois) ignorando o que muda sozinho.

  python3 scripts/minhas-garantias/comparar-build.py <dist-antes> <dist-depois>

Para cada arquivo (nome sem o hash):
  IDENTICO   igual byte a byte depois de trocar os hashes dos nomes de arquivo
  SO_NOMES   mesmo tamanho e igual depois de ignorar listas de import/export e
             nomes de 1-2 letras do minificador (o Rollup renomeia quando um
             chunk compartilhado ganha uma exportação)
  MUDOU      mudou de verdade (tem que ser só o que a fase mexeu)
  NOVO/SUMIU arquivo que só existe de um lado
"""
import os
import re
import sys

# O hash do Vite são os 8 caracteres antes da extensão (pode ter "-" dentro).
HASH = re.compile(r"-[A-Za-z0-9_-]{8}(\.(?:js|css))\b")
HASH_NO_ARQUIVO = re.compile(r"-[A-Za-z0-9_-]{8}(\.(?:js|css))$")


# Referência a arquivo dentro do código: "...<8 caracteres>.js" seguido de aspas.
HASH_REF = re.compile(r"[A-Za-z0-9_-]{8}(\.(?:js|css))(?=[\"'`)\s,])")


def ler_dist(d):
    out = {}
    for raiz, _, arquivos in os.walk(d):
        for a in arquivos:
            p = os.path.join(raiz, a)
            chave = HASH_NO_ARQUIVO.sub(r"\1", os.path.relpath(p, d))
            with open(p, "rb") as f:
                bruto = f.read()
            try:
                texto = bruto.decode("utf-8")
            except UnicodeDecodeError:
                texto = bruto.decode("latin1")
            texto = HASH_REF.sub(r"HASHHASH\1", texto)
            # carimbo da versão do build ("2026-11-20 10:04 · 9756a46"), muda a cada build
            texto = re.sub(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2} · [0-9a-f]{7}", "VERSAO_DO_BUILD", texto)
            out.setdefault(chave, []).append(texto)
    return out


def sem_nomes(s):
    s = re.sub(r'import\{[^}]*\}from"[^"]+";?', "IMPORT;", s)
    s = re.sub(r"export\{[^}]*\};?", "EXPORT;", s)
    return re.sub(r"(?<![A-Za-z0-9_$])[A-Za-z_$][A-Za-z0-9_$]?(?![A-Za-z0-9_$])", "I", s)


def main(antes, depois):
    a, b = ler_dist(antes), ler_dist(depois)
    contagem = {}
    for chave in sorted(set(a) | set(b)):
        if chave not in a:
            r = "NOVO"
        elif chave not in b:
            r = "SUMIU"
        elif sorted(a[chave]) == sorted(b[chave]):
            r = "IDENTICO"
        elif len(a[chave]) == len(b[chave]) == 1 and len(a[chave][0]) == len(b[chave][0]) and sem_nomes(a[chave][0]) == sem_nomes(b[chave][0]):
            r = "SO_NOMES"
        else:
            r = "MUDOU"
        contagem[r] = contagem.get(r, 0) + 1
        if r != "IDENTICO":
            print(f"{r:9} {chave}")
    print("resumo:", ", ".join(f"{k}={v}" for k, v in sorted(contagem.items())))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

import React from 'react';

/**
 * Tiny syntax highlighter for the short examples in the API docs (dark code panels). Good enough for the snippets we
 * write ourselves; not a general-purpose parser.
 */
export type CodeLanguage = 'curl' | 'javascript' | 'python' | 'json' | 'http';

const C = {
  keyword: 'text-sky-300',
  string: 'text-orange-200',
  number: 'text-violet-300',
  literal: 'text-emerald-300',
  comment: 'text-neutral-500 italic',
  flag: 'text-emerald-300',
  variable: 'text-amber-200',
  property: 'text-sky-300',
  command: 'text-pink-300',
  punctuation: 'text-neutral-500',
};

type Rule = [pattern: string, className: string];

const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;

const RULES: Record<CodeLanguage, Rule[]> = {
  json: [
    [String.raw`"(?:[^"\\]|\\.)*"(?=\s*:)`, C.property],
    [String.raw`"(?:[^"\\]|\\.)*"`, C.string],
    [String.raw`-?\b\d+(?:\.\d+)?\b`, C.number],
    [String.raw`\b(?:true|false|null)\b`, C.literal],
    [String.raw`[{}\[\],:]`, C.punctuation],
  ],
  curl: [
    [String.raw`^curl\b`, C.command],
    [String.raw`(?<=\s)-{1,2}[A-Za-z][\w-]*`, C.flag],
    [String.raw`\$[A-Z_][A-Z0-9_]*`, C.variable],
    [STRING, C.string],
    [String.raw`\\$`, C.punctuation],
  ],
  javascript: [
    [String.raw`//.*`, C.comment],
    ['`(?:[^`\\\\]|\\\\.)*`', C.string],
    [STRING, C.string],
    [String.raw`\b(?:const|let|await|new|return|if|throw|async|function)\b`, C.keyword],
    [String.raw`\b(?:true|false|null|undefined)\b`, C.literal],
    [String.raw`\b\d+\b`, C.number],
    [String.raw`\b[A-Z][A-Z0-9_]{2,}\b`, C.variable],
  ],
  python: [
    [String.raw`#.*`, C.comment],
    [String.raw`[fr]?"(?:[^"\\\n]|\\.)*"|[fr]?'(?:[^'\\\n]|\\.)*'`, C.string],
    [String.raw`\b(?:import|from|as|if|not|raise|with|def|return|for|in)\b`, C.keyword],
    [String.raw`\b(?:True|False|None)\b`, C.literal],
    [String.raw`\b\d+\b`, C.number],
    [String.raw`\b[A-Z][A-Z0-9_]{2,}\b`, C.variable],
  ],
  http: [
    [String.raw`^[\w-]+(?=:)`, C.property],
    [STRING, C.string],
  ],
};

const COMPILED = Object.fromEntries(
  Object.entries(RULES).map(([lang, rules]) => [
    lang,
    { regex: new RegExp(rules.map(([p]) => `(${p})`).join('|'), 'gm'), classes: rules.map(([, c]) => c) },
  ])
) as Record<CodeLanguage, { regex: RegExp; classes: string[] }>;

export function highlight(code: string, language: CodeLanguage): React.ReactNode[] {
  const { regex, classes } = COMPILED[language];
  const out: React.ReactNode[] = [];
  let last = 0;
  regex.lastIndex = 0;
  for (let match = regex.exec(code); match; match = regex.exec(code)) {
    if (match[0] === '') {
      regex.lastIndex += 1;
      continue;
    }
    if (match.index > last) out.push(code.slice(last, match.index));
    const group = match.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={match.index} className={classes[group]}>
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { StatusDot } from '../layout/page-kit';
import { CopyButton } from './CopyButton';
import { highlight, type CodeLanguage } from './highlight';
import {
  CLIPBOARD_EXAMPLE,
  ENDPOINTS,
  ERRORS,
  ERROR_EXAMPLE,
  LANGUAGES,
  errorTone,
  requestExample,
  type ApiErrorDoc,
  type EndpointDoc,
  type Language,
} from './apiReference';

const LANGUAGE_STORAGE_KEY = 'apiDocs.language';

const SECTIONS: { id: string; label: string; mono?: boolean }[] = [
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'basics', label: 'Basics' },
  ...ENDPOINTS.map((e) => ({ id: `endpoint-${e.id}`, label: e.path, mono: true })),
  { id: 'errors', label: 'Errors' },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

/** `code` spans inside short prose. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            className="rounded bg-neutral-100 px-1 py-px font-mono text-[0.85em] text-foreground dark:bg-neutral-800"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function CodePanel({
  title,
  code,
  language,
  languages,
  onLanguageChange,
  className,
}: {
  title: React.ReactNode;
  code: string;
  language: CodeLanguage;
  languages?: boolean;
  onLanguageChange?: (l: Language) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 py-1.5 pl-4 pr-1.5">
        <span className="truncate text-xs font-medium text-neutral-400">{title}</span>
        <div className="flex items-center gap-0.5">
          {languages &&
            LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => onLanguageChange?.(l.value)}
                aria-pressed={language === l.value}
                className={cn(
                  'h-7 rounded-md px-2 text-xs font-medium transition-colors',
                  language === l.value ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-neutral-200'
                )}
              >
                {l.label}
              </button>
            ))}
          {languages && <span className="mx-1 h-4 w-px bg-white/10" />}
          <CopyButton value={code} className="text-neutral-400 hover:bg-white/10 hover:text-white" />
        </div>
      </div>
      <pre className="max-h-[20rem] overflow-auto px-4 py-3.5 font-mono text-[12px] leading-[1.7] [color-scheme:dark]">
        <code>{highlight(code, language)}</code>
      </pre>
    </div>
  );
}

function SectionTitle({ id, children, lead }: { id: string; children: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="group flex items-center gap-2 text-lg font-semibold tracking-tight">
        {children}
        <a
          href={`#${id}`}
          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Link to this section"
        >
          #
        </a>
      </h2>
      {lead && <p className="mt-0.5 text-sm text-muted-foreground">{lead}</p>}
    </div>
  );
}

function ErrorChip({ error }: { error: ApiErrorDoc }) {
  return (
    <a
      href={`#error-${error.code}`}
      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-neutral-400 dark:hover:border-neutral-600"
    >
      <StatusDot tone={errorTone(error.status)} />
      {error.code}
    </a>
  );
}

function Endpoint({
  endpoint,
  baseURL,
  language,
  onLanguageChange,
}: {
  endpoint: EndpointDoc;
  baseURL: string;
  language: Language;
  onLanguageChange: (l: Language) => void;
}) {
  const errors = endpoint.errors
    .map((code) => ERRORS.find((e) => e.code === code))
    .filter((e): e is ApiErrorDoc => !!e);
  const id = `endpoint-${endpoint.id}`;
  return (
    <section id={id} className="scroll-mt-24">
      <SectionTitle id={id} lead={endpoint.summary}>
        <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-white dark:bg-white dark:text-neutral-900">
          {endpoint.method}
        </span>
        <code className="font-mono text-base">{endpoint.path}</code>
      </SectionTitle>

      <div className="grid gap-3 xl:grid-cols-2">
        <CodePanel
          title="Request"
          code={requestExample(endpoint, language, baseURL)}
          language={language}
          languages
          onLanguageChange={onLanguageChange}
        />
        <CodePanel
          title={`Response · ${endpoint.response.contentType}`}
          code={endpoint.response.example}
          language={endpoint.output === 'json' ? 'json' : 'http'}
        />
      </div>

      {endpoint.note && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Prose text={endpoint.note} />
        </p>
      )}

      {endpoint.fields.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          {endpoint.fields.map((f) => (
            <React.Fragment key={f.name}>
              <dt className="font-mono text-[12.5px] font-medium">{f.name}</dt>
              <dd className="mb-1 text-muted-foreground sm:mb-0">{f.description}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Can return</span>
        {errors.map((e) => (
          <ErrorChip key={e.code} error={e} />
        ))}
      </div>
    </section>
  );
}

function ErrorGroup({ title, errors }: { title: string; errors: ApiErrorDoc[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <p className="border-b bg-neutral-50/70 px-4 py-2 text-xs font-medium text-muted-foreground dark:bg-neutral-900/40">
        {title}
      </p>
      <ul className="divide-y">
        {errors.map((e) => (
          <li
            key={e.code}
            id={`error-${e.code}`}
            className="flex scroll-mt-24 flex-col gap-1 px-4 py-2.5 target:bg-amber-50/60 dark:target:bg-amber-500/5 xl:flex-row xl:items-baseline xl:gap-4"
          >
            <span className="flex shrink-0 items-baseline gap-2.5 xl:w-60">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                <StatusDot tone={errorTone(e.status)} />
                {e.status}
              </span>
              <code className="break-all font-mono text-[12.5px] font-medium">{e.code}</code>
            </span>
            <span className="text-sm text-muted-foreground">
              <Prose text={e.hint} />
              {e.only && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">{e.only} only</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Highlights the section currently in view in the side nav. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (LANGUAGES.some((l) => l.value === saved)) return saved as Language;
  } catch {
    // storage unavailable (private mode): fall back to cURL
  }
  return 'curl';
}

/** API reference: how to call the checker, what comes back, and what every error means. */
export function ApiDocs({ baseURL, onCreateKey }: { baseURL: string; onCreateKey: () => void }) {
  const [language, setLanguageState] = useState<Language>(readLanguage);
  const setLanguage = (l: Language) => {
    setLanguageState(l);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, l);
    } catch {
      // not remembered, that's fine
    }
  };
  const active = useActiveSection(SECTION_IDS);
  const summary = ENDPOINTS[0];

  const basics: { label: string; value: React.ReactNode; detail: string }[] = [
    {
      label: 'Base URL',
      value: <code className="font-mono text-[12.5px]">{baseURL}</code>,
      detail: 'Every call is a POST with the zipped package as `file`.',
    },
    {
      label: 'Auth',
      value: <code className="font-mono text-[12.5px]">Authorization: Bearer tc_…</code>,
      detail: 'Keys act as you and can only run checks.',
    },
    {
      label: 'Limits',
      value: <span className="tabular-nums">50 / hour · 1 at a time · 200 MB</span>,
      detail: 'Per user, across the web app and keys.',
    },
    {
      label: 'Request ID',
      value: <code className="font-mono text-[12.5px]">X-Request-ID</code>,
      detail: 'On every response. Send your own to trace a call; quote it when something breaks.',
    },
    {
      label: 'Versions',
      value: <code className="font-mono text-[12.5px]">/v1</code>,
      detail:
        'The old `/run`, `/summary` and `/run-and-download-xml` still work, but answer with a `Deprecation` header that points to their `/v1` path.',
    },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label="API reference" className="hidden lg:block">
        <ul className="sticky top-6 space-y-0.5 border-l text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l py-1 pl-3 transition-colors',
                  s.mono && 'whitespace-nowrap pl-5 font-mono text-[12px]',
                  active === s.id
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-neutral-300 hover:text-foreground dark:hover:border-neutral-700'
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-12">
        <section id="quickstart" className="scroll-mt-24">
          <SectionTitle id="quickstart" lead="From zip to customer message in three steps.">
            Quickstart
          </SectionTitle>
          <ol className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {[
              <Button
                key="key"
                variant="link"
                className="h-auto p-0 text-sm font-medium text-foreground underline decoration-neutral-300 underline-offset-4 dark:decoration-neutral-600"
                onClick={onCreateKey}
              >
                Create a key
              </Button>,
              <span key="zip" className="font-medium">
                Zip the package
              </span>,
              <span key="post" className="font-medium">
                POST it to <code className="font-mono text-[12.5px]">/summary</code>
              </span>,
            ].map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-100 font-mono text-[10px] tabular-nums text-muted-foreground dark:bg-neutral-800">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <CodePanel
            title={`POST ${summary.path}`}
            code={requestExample(summary, language, baseURL)}
            language={language}
            languages
            onLanguageChange={setLanguage}
          />
        </section>

        <section id="basics" className="scroll-mt-24">
          <SectionTitle id="basics">Basics</SectionTitle>
          <dl className="divide-y overflow-hidden rounded-xl border bg-card">
            {basics.map((b) => (
              <div key={b.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{b.label}</dt>
                <dd className="min-w-0">
                  <div className="break-all text-sm">{b.value}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Prose text={b.detail} />
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {ENDPOINTS.map((endpoint) => (
          <div key={endpoint.id}>
            <Endpoint endpoint={endpoint} baseURL={baseURL} language={language} onLanguageChange={setLanguage} />
            {endpoint.id === 'summary' && (
              <CodePanel
                title="Copy it like the web app does (both versions, inside a click)"
                code={CLIPBOARD_EXAMPLE}
                language="javascript"
                className="mt-4"
              />
            )}
          </div>
        ))}

        <section id="errors" className="scroll-mt-24">
          <SectionTitle
            id="errors"
            lead={<Prose text="Same shape everywhere. Branch on `code`; `message` is for people." />}
          >
            Errors
          </SectionTitle>
          <CodePanel title="Error body" code={ERROR_EXAMPLE} language="json" className="mb-4" />
          <div className="space-y-3">
            <ErrorGroup title="Fix on your side · 4xx" errors={ERRORS.filter((e) => e.status < 500)} />
            <ErrorGroup title="On our side · 5xx" errors={ERRORS.filter((e) => e.status >= 500)} />
          </div>
        </section>
      </div>
    </div>
  );
}

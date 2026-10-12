import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clipboard,
  FileArchive,
  Fingerprint,
  Gauge,
  KeyRound,
  Rocket,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { StatusDot } from '../layout/page-kit';
import { CopyButton } from './CopyButton';
import {
  CLIPBOARD_EXAMPLE,
  ENDPOINTS,
  ERRORS,
  ERROR_EXAMPLE,
  LANGUAGES,
  LIMITS,
  errorTone,
  requestExample,
  type EndpointDoc,
  type Language,
} from './apiReference';

const LANGUAGE_STORAGE_KEY = 'apiDocs.language';

const SECTIONS = [
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'limits', label: 'Limits' },
  { id: 'request-ids', label: 'Request IDs' },
  ...ENDPOINTS.map((e) => ({
    id: `endpoint-${e.id}`,
    label: e.path,
    mono: true,
  })),
  { id: 'errors', label: 'Errors' },
] as { id: string; label: string; mono?: boolean }[];

/** `code` spans inside prose. */
function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
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
        ),
      )}
    </span>
  );
}

/** Light syntax colors for JSON in the dark code panels. */
function JsonCode({ source }: { source: string }) {
  const tokens = source.split(
    /("(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|\bnull\b|\btrue\b|\bfalse\b)/g,
  );
  return (
    <>
      {tokens.map((t, i) => {
        if (!t) return null;
        const isKey = t.startsWith('"') && /^\s*:/.test(tokens[i + 1] ?? '');
        const cls = isKey
          ? 'text-sky-300'
          : t.startsWith('"')
            ? 'text-orange-200'
            : /^-?\d/.test(t)
              ? 'text-violet-300'
              : /^(null|true|false)$/.test(t)
                ? 'text-emerald-300'
                : 'text-neutral-500';
        return (
          <span key={i} className={cls}>
            {t}
          </span>
        );
      })}
    </>
  );
}

function CodePanel({
  title,
  code,
  json,
  languages,
  language,
  onLanguageChange,
  className,
}: {
  title: string;
  code: string;
  json?: boolean;
  languages?: { value: Language; label: string }[];
  language?: Language;
  onLanguageChange?: (l: Language) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 py-1.5 pl-4 pr-1.5">
        <span className="truncate text-xs font-medium text-neutral-400">{title}</span>
        <div className="flex items-center gap-0.5">
          {languages?.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => onLanguageChange?.(l.value)}
              aria-pressed={language === l.value}
              className={cn(
                'h-7 rounded-md px-2 text-xs font-medium transition-colors',
                language === l.value ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-neutral-200',
              )}
            >
              {l.label}
            </button>
          ))}
          {languages && <span className="mx-1 h-4 w-px bg-white/10" />}
          <CopyButton value={code} className="text-neutral-400 hover:bg-white/10 hover:text-white" />
        </div>
      </div>
      <pre className="max-h-[22rem] overflow-auto px-4 py-3.5 font-mono text-[12px] leading-[1.7] [color-scheme:dark]">
        <code>{json ? <JsonCode source={code} /> : code}</code>
      </pre>
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {eyebrow && (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
      )}
      <h2 className="group flex items-center gap-2 text-lg font-semibold tracking-tight">
        {title}
        <a
          href={`#${id}`}
          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Link to this section"
        >
          #
        </a>
      </h2>
      {children && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}

function StatusCode({ status }: { status: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-foreground">
      <StatusDot tone={errorTone(status)} />
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-white dark:bg-white dark:text-neutral-900">
      {method}
    </span>
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
  const errors = endpoint.errors.map((code) => ERRORS.find((e) => e.code === code)!).filter(Boolean);
  return (
    <section id={`endpoint-${endpoint.id}`} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MethodBadge method={endpoint.method} />
        <code className="font-mono text-[15px] font-semibold">{endpoint.path}</code>
        <span className="text-sm text-muted-foreground">· {endpoint.name}</span>
      </div>
      <p className="text-sm font-medium">{endpoint.summary}</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        <Prose text={endpoint.description} />
      </p>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <CodePanel
          title="Request"
          code={requestExample(endpoint, language, baseURL)}
          languages={LANGUAGES}
          language={language}
          onLanguageChange={onLanguageChange}
        />
        <CodePanel
          title={`Response · ${endpoint.response.contentType}`}
          code={endpoint.response.example}
          json={endpoint.response.contentType === 'application/json'}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {endpoint.fields.length > 0 && (
          <dl className="divide-y">
            {endpoint.fields.map((f) => (
              <div key={f.name} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <code className="font-mono text-[12.5px] font-medium">{f.name}</code>
                  <span className="font-mono text-[11px] text-muted-foreground">{f.type}</span>
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  <Prose text={f.description} />
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 bg-neutral-50/70 px-4 py-2.5 dark:bg-neutral-900/40',
            endpoint.fields.length > 0 && 'border-t',
          )}
        >
          <span className="mr-1 text-xs text-muted-foreground">Errors</span>
          {errors.map((e) => (
            <a
              key={e.code}
              href={`#error-${e.code}`}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-neutral-400 dark:hover:border-neutral-600"
            >
              <StatusDot tone={errorTone(e.status)} />
              {e.code}
            </a>
          ))}
        </div>
      </div>
    </section>
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
      { rootMargin: '-15% 0px -70% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const SECTION_IDS = SECTIONS.map((s) => s.id);

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
                    : 'border-transparent text-muted-foreground hover:border-neutral-300 hover:text-foreground dark:hover:border-neutral-700',
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-14">
        {/* Quickstart */}
        <section id="quickstart" className="scroll-mt-24">
          <SectionHeading id="quickstart" eyebrow="Quickstart" title="From zip to customer message in three steps">
            Everything goes over HTTPS to one base URL, and every call is a multipart upload of the packaged template.
          </SectionHeading>
          <ol className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: KeyRound,
                title: 'Create a key',
                body: 'It acts as you and can only run checks.',
                action: true,
              },
              {
                icon: FileArchive,
                title: 'Package the template',
                body: 'InDesign: File > Package, then zip the folder.',
              },
              {
                icon: Rocket,
                title: 'Send it',
                body: 'POST the zip to /summary. Paste the result into Intercom.',
              },
            ].map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <span className="absolute right-3 top-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                  0{i + 1}
                </span>
                <step.icon className="mb-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                {step.action && (
                  <Button variant="link" size="sm" className="mt-1.5 h-auto gap-1 p-0 text-xs" onClick={onCreateKey}>
                    Create a key <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ol>
          <CodePanel
            title={`POST ${summary.path}`}
            code={requestExample(summary, language, baseURL)}
            languages={LANGUAGES}
            language={language}
            onLanguageChange={setLanguage}
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            Base URL
            <code className="rounded bg-neutral-100 px-1.5 py-px font-mono text-[11px] text-foreground dark:bg-neutral-800">
              {baseURL}
            </code>
            <CopyButton
              value={baseURL}
              className="h-6 text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
            />
          </p>
        </section>

        {/* Authentication */}
        <section id="authentication" className="scroll-mt-24">
          <SectionHeading id="authentication" eyebrow="Basics" title="Authentication">
            Send your key as a bearer token. Keys act on behalf of whoever created them and can only call the three
            check endpoints below, so a leaked key can’t make more keys or read analytics.
          </SectionHeading>
          <CodePanel title="Header" code="Authorization: Bearer tc_…" />
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Keep keys in a secrets manager or CI secret, never in code.
            </li>
            <li className="flex gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Keys expire. Revoke one the moment you think it leaked.
            </li>
          </ul>
        </section>

        {/* Limits */}
        <section id="limits" className="scroll-mt-24">
          <SectionHeading id="limits" eyebrow="Basics" title="Limits">
            Generous for scripts, firm for runaway loops. Going over gets a 429 or 413 with a code that says which.
          </SectionHeading>
          <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3 sm:divide-x">
            {LIMITS.map((l) => (
              <div key={l.unit} className="border-b px-5 py-4 last:border-b-0 sm:border-b-0">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">{l.value}</span>
                  <span className="text-sm text-muted-foreground">{l.unit}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" aria-hidden />
                  {l.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Request IDs */}
        <section id="request-ids" className="scroll-mt-24">
          <SectionHeading id="request-ids" eyebrow="Basics" title="Request IDs">
            Every response has an <Prose text="`X-Request-ID`" /> header, and every error body repeats it. Send your own
            (letters, digits, <Prose text="`. _ : -`" />, up to 128 characters), like an Intercom conversation ID, to
            find a call in our logs from your side. Something went wrong? The request ID is the fastest way to a fix.
          </SectionHeading>
          <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
            <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <code className="font-mono text-[12.5px]">X-Request-ID: intercom-48213</code>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">comes back on the response and in the server logs</span>
          </div>
        </section>

        {/* Endpoints */}
        <div className="space-y-14">
          {ENDPOINTS.map((endpoint) => (
            <div key={endpoint.id}>
              <Endpoint endpoint={endpoint} baseURL={baseURL} language={language} onLanguageChange={setLanguage} />
              {endpoint.id === 'summary' && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-start">
                  <div className="flex shrink-0 gap-2.5 lg:w-60">
                    <Clipboard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">Copy it like the web app does</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Put both versions on the clipboard, inside the click handler. Intercom uses the HTML; anything
                        else falls back to the text.
                      </p>
                    </div>
                  </div>
                  <CodePanel title="JavaScript" code={CLIPBOARD_EXAMPLE} className="min-w-0 flex-1" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Errors */}
        <section id="errors" className="scroll-mt-24">
          <SectionHeading id="errors" eyebrow="Reference" title="Errors">
            Every error has the same shape. Branch on <Prose text="`code`" />; <Prose text="`message`" /> is written for
            people and may change. Amber means something to fix on your side, red means ours.
          </SectionHeading>
          <CodePanel title="Error body" code={ERROR_EXAMPLE} json className="mb-4" />
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-[15rem_minmax(0,1fr)] gap-6 border-b bg-neutral-50/70 px-4 py-2 text-xs font-medium text-muted-foreground dark:bg-neutral-900/40 xl:grid">
              <span>Status and code</span>
              <span>What happened · what to do</span>
            </div>
            <ul className="divide-y">
              {ERRORS.map((e) => (
                <li
                  key={e.code}
                  id={`error-${e.code}`}
                  className="grid scroll-mt-24 gap-1.5 px-4 py-3 target:bg-amber-50/60 dark:target:bg-amber-500/5 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-6"
                >
                  <div className="flex items-baseline gap-3">
                    <StatusCode status={e.status} />
                    <code className="break-all font-mono text-[12.5px] font-medium">{e.code}</code>
                  </div>
                  <div className="text-sm leading-relaxed">
                    <p>
                      <Prose text={e.when} />
                    </p>
                    <p className="text-muted-foreground">
                      <Prose text={e.fix} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />A 500 is on us. Retrying is fine; if it keeps
            happening, the request ID tells us exactly what broke.
          </p>
        </section>
      </div>
    </div>
  );
}

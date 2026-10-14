import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { StatusDot, secondaryActionClass } from '../layout/page-kit';
import { CopyButton } from './CopyButton';
import { highlight, type CodeLanguage } from './highlight';
import {
  AUTH_EXAMPLE,
  ENDPOINTS,
  ERRORS,
  ERROR_EXAMPLE,
  LANGUAGES,
  LIMITS,
  REQUEST_BODY,
  REQUEST_HEADERS,
  RETRY_LABEL,
  errorTone,
  requestExample,
  type ApiErrorDoc,
  type Attribute,
  type EndpointDoc,
  type Language,
} from './apiReference';

const LANGUAGE_STORAGE_KEY = 'apiDocs.language';

type NavItem = { id: string; label: string; method?: string };

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'quickstart', label: 'Quickstart' },
    ],
  },
  {
    title: 'Endpoints',
    items: ENDPOINTS.map((e) => ({ id: `endpoint-${e.id}`, label: e.name, method: e.method })),
  },
  {
    title: 'Reference',
    items: [
      { id: 'limits', label: 'Rate limits' },
      { id: 'timeouts', label: 'Timeouts' },
      { id: 'request-ids', label: 'Request IDs' },
      { id: 'errors', label: 'Errors' },
    ],
  },
];
const SECTION_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

/** `code` spans inside short prose. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <InlineCode key={i}>{part.slice(1, -1)}</InlineCode>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[0.85em] text-foreground dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </code>
  );
}

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('max-w-[68ch] text-sm leading-6 text-muted-foreground', className)}>{children}</p>;
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
    <div className={cn('min-w-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200', className)}>
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/10 py-1.5 pl-4 pr-1.5">
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
      <pre className="max-h-[22rem] overflow-auto px-4 py-3.5 font-mono text-[12px] leading-[1.7] [color-scheme:dark]">
        <code>{highlight(code, language)}</code>
      </pre>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-10 first:border-t-0 first:pt-0">
      {eyebrow && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{eyebrow}</p>}
      <h2 className="group mb-3 flex items-center gap-2 text-xl font-semibold tracking-tight">
        {title}
        <a
          href={`#${id}`}
          className="text-base font-normal text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Link to this section"
        >
          #
        </a>
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function SubHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {aside && <span className="font-mono text-[11px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

function MethodTag({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        'rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] font-semibold tracking-wide text-muted-foreground dark:border-neutral-800 dark:bg-neutral-900',
        className
      )}
    >
      {method}
    </span>
  );
}

/** Stripe-style attribute list: name, type and requirement on one line, description underneath. */
function AttributeList({ attributes, nested }: { attributes: Attribute[]; nested?: boolean }) {
  return (
    <ul className={cn('divide-y', nested && 'mt-3 rounded-lg border')}>
      {attributes.map((a) => (
        <li key={a.name} className={cn('py-3', nested ? 'px-3.5' : 'first:pt-1')}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <code className="font-mono text-[13px] font-semibold text-foreground">{a.name}</code>
            <span className="font-mono text-xs text-muted-foreground">{a.type}</span>
            {a.required && <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Required</span>}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            <Prose text={a.description} />
          </p>
          {a.children && <AttributeList attributes={a.children} nested />}
        </li>
      ))}
    </ul>
  );
}

function ErrorTable({ errors, showScope }: { errors: ApiErrorDoc[]; showScope?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-neutral-50 text-xs text-muted-foreground dark:bg-neutral-900/60">
          <tr>
            <th className="w-20 px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Code</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Retry</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {errors.map((e) => (
            <tr
              key={e.code}
              id={showScope ? `error-${e.code}` : undefined}
              className="scroll-mt-24 align-top target:bg-amber-50/60 dark:target:bg-amber-500/5"
            >
              <td className="whitespace-nowrap px-4 py-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
                  <StatusDot tone={errorTone(e.status)} />
                  {e.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {showScope ? (
                  <code className="font-mono text-[12.5px] font-medium">{e.code}</code>
                ) : (
                  <a
                    href={`#error-${e.code}`}
                    className="font-mono text-[12.5px] font-medium underline decoration-neutral-300 underline-offset-4 hover:decoration-foreground dark:decoration-neutral-700"
                  >
                    {e.code}
                  </a>
                )}
              </td>
              <td className="min-w-[16rem] px-4 py-3 leading-6 text-muted-foreground">
                <Prose text={e.hint} />
                {showScope && e.only && (
                  <span className="mt-1 block text-xs">
                    Only returned by <InlineCode>{e.only}</InlineCode>.
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                <Prose text={RETRY_LABEL[e.retry]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  return (
    <Section id={`endpoint-${endpoint.id}`} eyebrow="Endpoint" title={endpoint.name}>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <MethodTag method={endpoint.method} />
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{endpoint.path}</code>
        <CopyButton
          value={`${baseURL}${endpoint.path}`}
          className="-mr-1.5 text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
        />
      </div>
      <P>{endpoint.summary}</P>
      {endpoint.note && (
        <p className="max-w-[68ch] border-l-2 border-neutral-300 pl-3 text-sm leading-6 text-muted-foreground dark:border-neutral-700">
          <Prose text={endpoint.note} />
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <CodePanel
          title="Request"
          code={requestExample(endpoint, language, baseURL)}
          language={language}
          languages
          onLanguageChange={onLanguageChange}
        />
        <CodePanel
          title={`Response · ${endpoint.response.status}`}
          code={endpoint.response.example}
          language={endpoint.output === 'json' ? 'json' : 'http'}
        />
      </div>

      {endpoint.authenticated !== false && (
        <div className="grid gap-8 pt-2 md:grid-cols-2">
          <div>
            <SubHeading>Headers</SubHeading>
            <AttributeList attributes={REQUEST_HEADERS} />
          </div>
          <div>
            <SubHeading aside="multipart/form-data">Body</SubHeading>
            <AttributeList attributes={REQUEST_BODY} />
          </div>
        </div>
      )}

      <div>
        <SubHeading aside={endpoint.response.contentType}>Response</SubHeading>
        {endpoint.fields.length > 0 ? (
          <AttributeList attributes={endpoint.fields} />
        ) : (
          <P className="pt-3">
            The response body is the ZIP archive itself, sent as an attachment named after the template.
          </P>
        )}
      </div>

      {errors.length > 0 && (
        <div className="space-y-3">
          <SubHeading>Errors</SubHeading>
          <ErrorTable errors={errors} />
        </div>
      )}
    </Section>
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

  const overview: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Base URL',
      value: (
        <span className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 truncate font-mono text-[13px]">{baseURL}</code>
          <CopyButton
            value={baseURL}
            className="text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
          />
        </span>
      ),
    },
    { label: 'Version', value: <code className="font-mono text-[13px]">v1</code> },
    { label: 'Requests', value: <code className="font-mono text-[13px]">multipart/form-data</code> },
    { label: 'Responses', value: <code className="font-mono text-[13px]">application/json</code> },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <nav aria-label="API reference" className="hidden lg:block">
        <div className="sticky top-6 space-y-6">
          {NAV.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{group.title}</p>
              <ul className="space-y-0.5 border-l text-sm">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={active === item.id ? 'location' : undefined}
                      className={cn(
                        '-ml-px flex items-center justify-between gap-2 border-l py-1 pl-3 transition-colors',
                        active === item.id
                          ? 'border-foreground font-medium text-foreground'
                          : 'border-transparent text-muted-foreground hover:border-neutral-300 hover:text-foreground dark:hover:border-neutral-700'
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.method && <MethodTag method={item.method} className="text-[9px]" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-10">
        <Section id="overview" title="Template Checker API">
          <P>
            The Template Checker API runs the same checks as the web app on a packaged InDesign template. Use it to check
            templates from scripts, CI pipelines or internal tools, and to retrieve the results, a customer-facing summary
            or the generated XML.
          </P>
          <dl className="divide-y rounded-lg border">
            {overview.map((row) => (
              <div key={row.label} className="grid items-center gap-1 px-4 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="authentication" title="Authentication">
          <P>
            Authenticate every request with an API key, sent as a bearer token in the <InlineCode>Authorization</InlineCode>{' '}
            header. Keys act on behalf of the user who created them and can only call the check endpoints. Requests
            without a valid key return <InlineCode>401 unauthorized</InlineCode>.
          </P>
          <CodePanel title="Header" code={AUTH_EXAMPLE} language="http" />
          <dl className="divide-y rounded-lg border">
            {[
              ['Format', 'Keys start with `tc_`, followed by 43 URL-safe characters.'],
              ['Visibility', 'A key is shown once, when it is created. Only a hash is stored, so a lost key cannot be recovered; create a new one instead.'],
              ['Expiry', 'Keys expire after 30 days, 90 days, 6 months or 1 year, chosen at creation. Admins can also create keys that never expire. Expired keys return `401 unauthorized`.'],
              ['Scope', 'Keys can call the check endpoints only. They cannot manage users, keys or settings.'],
              ['Revocation', 'Revoking a key on the Keys tab takes effect immediately.'],
            ].map(([label, text]) => (
              <div key={label} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{label}</dt>
                <dd className="text-sm leading-6">
                  <Prose text={text} />
                </dd>
              </div>
            ))}
          </dl>
          <P>
            Treat API keys as secrets. Store them in environment variables or a secrets manager, never in client-side code
            or source control, and use a separate key for each integration so each can be revoked on its own.
          </P>
          <Button variant="outline" size="sm" className={cn(secondaryActionClass, 'h-8')} onClick={onCreateKey}>
            Create a key
          </Button>
        </Section>

        <Section id="quickstart" title="Quickstart">
          <ol className="max-w-[68ch] space-y-2 text-sm leading-6 text-muted-foreground">
            {[
              'Create an API key and store it as `TC_KEY`.',
              'Package the template in InDesign (File › Package) and compress the folder as a ZIP archive.',
              `Send the archive to \`${summary.path}\` as the \`file\` field.`,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] tabular-nums text-foreground">
                  {i + 1}
                </span>
                <span>
                  <Prose text={step} />
                </span>
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
        </Section>

        {ENDPOINTS.map((endpoint) => (
          <Endpoint
            key={endpoint.id}
            endpoint={endpoint}
            baseURL={baseURL}
            language={language}
            onLanguageChange={setLanguage}
          />
        ))}

        <Section id="limits" title="Rate limits">
          <P>
            Limits apply per user and are shared between the web app and all of that user’s API keys. Requests that
            exceed a limit are rejected without running a check.
          </P>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs text-muted-foreground dark:bg-neutral-900/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Limit</th>
                  <th className="px-4 py-2 font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">When exceeded</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {LIMITS.map((l) => (
                  <tr key={l.name}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{l.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{l.value}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Prose text={l.exceeded} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="timeouts" title="Timeouts">
          <P>
            Checks run synchronously: the response is sent once the check has finished. Most checks complete within
            seconds, but large packages can take several minutes. The server allows up to 10 minutes per request, so set
            your client timeout to at least 600 seconds.
          </P>
          <P>
            The service scales down when idle, so the first request after a quiet period can take a few seconds longer.
            To avoid this before a batch of checks, call <InlineCode>GET /health</InlineCode> first.
          </P>
        </Section>

        <Section id="request-ids" title="Request IDs">
          <P>
            Every response includes an <InlineCode>X-Request-ID</InlineCode> header. To correlate requests with your own
            logs, send your own ID in the same header: up to 128 letters, digits, <InlineCode>.</InlineCode>{' '}
            <InlineCode>_</InlineCode> <InlineCode>:</InlineCode> or <InlineCode>-</InlineCode>. Otherwise one is
            generated. Include the request ID when reporting a problem.
          </P>
        </Section>

        <Section id="errors" title="Errors">
          <P>
            The API uses conventional HTTP status codes: <InlineCode>4xx</InlineCode> indicates a problem with the request,{' '}
            <InlineCode>5xx</InlineCode> a problem on our side. Every error has the same body. Use{' '}
            <InlineCode>code</InlineCode> for programmatic handling; <InlineCode>message</InlineCode> is written for
            people and may change.
          </P>
          <CodePanel title="Error response" code={ERROR_EXAMPLE} language="json" />
          <P>
            Retry only the errors marked as retryable below. For <InlineCode>rate_limited</InlineCode>, wait for the
            number of seconds in the <InlineCode>Retry-After</InlineCode> header. For other retryable errors, use
            exponential backoff and stop after a few attempts.
          </P>
          <ErrorTable errors={ERRORS} showScope />
        </Section>
      </div>
    </div>
  );
}

import React from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Download, Wrench, BookOpen, AlertCircle, Zap, AlertTriangle } from 'lucide-react';
import { LATEST_EXTENSION_VERSION, EXTENSION_DOWNLOAD_URL } from '../../constants/extension';

const INSTALL_STEPS = [
  'Download the ZIP file using the button above.',
  'Unzip the file to a folder on your computer.',
  <>Open your browser (Chrome, Arc, or any Chromium-based browser) and go to <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-medium text-foreground">chrome://extensions</code> (or your browser’s equivalent).</>,
  <>Turn on <strong className="text-foreground font-medium">Developer mode</strong> (toggle in the top-right).</>,
  <>Click <strong className="text-foreground font-medium">Load unpacked</strong> and select the unzipped extension folder (the one containing <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-medium text-foreground">manifest.json</code>).</>,
  'The Template Checker extension will appear in your extensions list and in the browser toolbar.',
];

function ExtensionDownload() {
  return (
    <div className="min-w-0 w-full max-w-[720px] mx-auto overflow-x-hidden px-4 pb-16 pt-10 sm:px-6">
      {/* Hero: title + experimental badge + disclaimer */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <h1 className="font-guise m-0 text-2xl font-semibold tracking-tight sm:text-3xl">
            Checker Extension
          </h1>
          <Badge
            variant="secondary"
            className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400"
          >
            Experimental
          </Badge>
        </div>
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 dark:border-amber-400/15 dark:bg-amber-400/5">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
          <p className="text-sm text-muted-foreground leading-relaxed">
            This is another weekend project—the extension may break or stop working at any time. Use at your own risk; it is not officially supported by Frontify.
          </p>
        </div>
      </header>

      {/* Primary CTA: download */}
      <section className="mb-10" aria-labelledby="download-heading">
        <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Download className="h-5 w-5" aria-hidden />
              <CardTitle id="download-heading" className="text-lg font-semibold text-foreground">
                Download
              </CardTitle>
            </div>
            <CardDescription>
              Works in any Chromium-based browser (Chrome, Arc, Edge, etc.). Check templates directly from Frontify—one-click install from ZIP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={EXTENSION_DOWNLOAD_URL}
              download="frontify-template-checker-extension.zip"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/25 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download extension (ZIP)
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              v{LATEST_EXTENSION_VERSION} · Unzip and load unpacked in Chrome, Arc, or any Chromium-based browser
            </p>
          </CardContent>
        </Card>
      </section>

      {/* How to install: stepped list */}
      <section className="mb-10" aria-labelledby="install-heading">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 id="install-heading" className="font-guise m-0 text-lg font-semibold tracking-tight">
            How to install
          </h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ol className="relative space-y-0">
              {INSTALL_STEPS.map((content, i) => (
                <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < INSTALL_STEPS.length - 1 && (
                    <span
                      className="absolute left-[11px] top-8 bottom-0 w-px bg-border"
                      aria-hidden
                    />
                  )}
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">
                    {content}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* How to use */}
      <section className="mb-4" aria-labelledby="use-heading">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 id="use-heading" className="font-guise m-0 text-lg font-semibold tracking-tight">
            How to use
          </h2>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              On a Frontify backend library (templating) page, open <strong className="text-foreground font-medium">Browser Top Toolbar → Extensions → Frontify Template Checker</strong>.
            </p>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
                Run a check
              </h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">1.</span>
                  <span>Optional: <strong className="text-foreground font-medium">Remove sidebar</strong> to hide the Frontify  settings panel and see the template full-width.</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">2.</span>
                  <span>Click <strong className="text-foreground font-medium">Run</strong> and follow the purple pulse hints on the buttons.</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">3.</span>
                  <span>
                    <strong className="text-foreground font-medium">Export</strong> → <strong className="text-foreground font-medium">InDesign (with changes)</strong> → <strong className="text-foreground font-medium">Download</strong>. When the bottom progress bar is done, click <strong className="text-foreground font-medium">Checker</strong> to open Template Checker in a new tab.
                  </span>
                </li>
              </ol>
            </div>

            <div className="pt-2 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2">Side-by-side tips</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Keep the Checker tab and Frontify tab open <strong className="text-foreground font-medium">side by side</strong> so you can see both at the same time—this gives you the best experience.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span>In <strong className="text-foreground font-medium">Frontify</strong>, select an element → Checker shows only that element’s issues.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span>In <strong className="text-foreground font-medium">Frontify</strong>, select a page or spread → Checker filters the list to that page/spread only.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span>In <strong className="text-foreground font-medium">Checker</strong>, click an issue → the matching element is highlighted in Frontify.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span>In <strong className="text-foreground font-medium">Checker</strong>, turn on <strong className="text-foreground font-medium">Highlight issues</strong> → every issue on the current Frontify page is highlighted for quick discovery.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/10 px-4 py-3 dark:border-amber-400/25 dark:bg-amber-400/10">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1.5 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                Troubleshooting
              </h3>
              <p className="text-sm text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
                Keep only <strong className="font-semibold text-amber-900 dark:text-amber-100">one</strong> Template Checker browser tab open. If you have multiple Checker tabs, the extension may send highlight and filter messages to the wrong tab.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default ExtensionDownload;

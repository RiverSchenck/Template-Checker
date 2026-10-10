import React, { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AlertCircle, FileArchive, FileCheck2, Upload, X } from 'lucide-react';
import { ValidationResult } from '../../types';
import countValidationIssues from '../ValidationCount';
import SuccessModal from './SuccessModal';
import { Button } from '../ui/button';
import { Segmented } from '../layout/page-kit';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { useAuth } from '../AuthContext';
import { cn } from '../../lib/utils';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

type Output = 'results' | 'xml';
type Phase = 'idle' | 'uploading' | 'checking';

interface TemplateUploaderProps {
  checkerResponse: (jsonResponse: ValidationResult, setPrevious?: boolean) => void;
  setPrevious?: boolean;
  onUploadComplete?: () => void;
  seeDetails?: (value: boolean) => void;
  navigateToResults?: () => void;
  /** Center the output toggle and hint under the drop area (the page card). */
  centered?: boolean;
  className?: string;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Drop zone, output choice and upload/check progress. Used by the page and the reupload dialog. */
export function TemplateUploader({
  checkerResponse,
  setPrevious = false,
  onUploadComplete,
  seeDetails,
  navigateToResults,
  centered = false,
  className,
}: TemplateUploaderProps) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [output, setOutput] = useState<Output>('results');
  const [phase, setPhase] = useState<Phase>('idle');
  const [current, setCurrent] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const { session } = useAuth();
  const busy = phase !== 'idle';

  useEffect(() => {
    if (phase !== 'checking') return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => () => xhrRef.current?.abort(), []);

  const doUpload = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError(`${file.name} isn't a .zip file. Package the template in InDesign and upload the .zip.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} is ${formatSize(file.size)}. The limit is 200 MB. Remove unused links or fonts and try again.`);
        return;
      }

      const downloadXML = output === 'xml';
      setCurrent(file);
      setPhase('uploading');
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const result = await new Promise<{ ok: boolean; body: Blob | string } | null>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          const headers = getAuthHeaders(session?.access_token);

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          });
          xhr.upload.addEventListener('load', () => setPhase('checking'));
          xhr.addEventListener('load', () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: xhr.response }));
          xhr.addEventListener('error', () => reject(new Error("Couldn't reach the checker. Check your connection and try again.")));
          xhr.addEventListener('abort', () => resolve(null));

          xhr.open('POST', downloadXML ? `${baseURL}/run-and-download-xml` : `${baseURL}/run`);
          xhr.responseType = downloadXML ? 'blob' : 'text';
          Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
          xhr.send(formData);
        });

        if (!result) return; // cancelled

        if (!result.ok) {
          const errorText = typeof result.body === 'string' ? result.body : await (result.body as Blob).text();
          let errorMessage = 'The check failed. Try again, or contact the team if it keeps happening.';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
          } catch {
            // keep the generic message; raw response bodies aren't user-facing
          }
          throw new Error(errorMessage);
        }

        if (downloadXML) {
          const url = window.URL.createObjectURL(result.body as Blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${file.name.replace(/\.[^.]+$/, '')}_output_XML.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          toast.success('XML download started');
        } else {
          const text = typeof result.body === 'string' ? result.body : await (result.body as Blob).text();
          const results: ValidationResult = JSON.parse(text)?.content?.results;
          checkerResponse(results, setPrevious);
          onUploadComplete?.();
          const { totalErrors, totalWarnings, totalInfos } = countValidationIssues(results);
          if (totalErrors === 0 && totalWarnings === 0 && totalInfos === 0) {
            setShowSuccessModal(true);
          } else {
            navigateToResults?.();
          }
          toast.success(`${file.name} checked`);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'The check failed. Try again.');
      } finally {
        xhrRef.current = null;
        setPhase('idle');
        setCurrent(null);
      }
    },
    [output, checkerResponse, setPrevious, onUploadComplete, navigateToResults, session?.access_token]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const item = e.dataTransfer.files[0];
      if (item && !busy) doUpload(item);
    },
    [doUpload, busy]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = e.target.files?.[0];
      if (chosen) doUpload(chosen);
      e.target.value = '';
    },
    [doUpload]
  );

  return (
    <div className={cn('w-full space-y-4', className)}>
      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        seeDetails={seeDetails}
        navigateToResults={navigateToResults}
      />

      {busy && current ? (
        <div className="flex min-h-[13rem] flex-col justify-center rounded-xl border bg-card px-6 py-8" aria-live="polite">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-muted/50">
                <FileArchive className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={current.name}>
                  {current.name}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatSize(current.size)} ·{' '}
                  {phase === 'uploading' ? `Uploading ${uploadProgress}%` : `Checking template · ${formatElapsed(elapsed)}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => xhrRef.current?.abort()}>
                Cancel
              </Button>
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
              {phase === 'uploading' ? (
                <div
                  className="h-full rounded-full bg-foreground/70 transition-[width] duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              ) : (
                <div className="h-full w-2/5 animate-indeterminate rounded-full bg-foreground/70" />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {phase === 'uploading'
                ? 'Uploading your template…'
                : output === 'xml'
                  ? 'Converting to XML. The download starts when it’s ready.'
                  : 'Checking styles, text boxes, fonts and images…'}
            </p>
          </div>
        </div>
      ) : (
        <label
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            'group flex min-h-[13rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
            isDragging
              ? 'border-foreground/50 bg-muted'
              : 'border-muted-foreground/45 bg-muted/40 hover:border-muted-foreground/70 hover:bg-muted/60'
          )}
        >
          <input type="file" accept=".zip" onChange={onFileInputChange} className="sr-only" />
          <div
            className={cn(
              'grid h-12 w-12 place-items-center rounded-full border bg-background shadow-sm transition-transform',
              isDragging ? '-translate-y-0.5' : 'group-hover:-translate-y-0.5'
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            {isDragging ? (
              'Drop to check'
            ) : (
              <>
                Drop a .zip here or <span className="underline decoration-muted-foreground/50 underline-offset-4">browse</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Packaged InDesign template, up to 200 MB</p>
        </label>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={cn('flex items-center gap-x-3 gap-y-1.5', centered ? 'flex-col' : 'flex-wrap')}>
        <Segmented<Output>
          ariaLabel="Output"
          value={output}
          onChange={(v) => !busy && setOutput(v)}
          options={[
            { value: 'results', label: 'Show results' },
            { value: 'xml', label: 'Download XML' },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          {output === 'results'
            ? 'Opens the results when the check is done.'
            : 'Downloads converted XML instead of results.'}
        </p>
      </div>
    </div>
  );
}

export default function FileUploadPage(props: TemplateUploaderProps) {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 pb-24 pt-10">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-8">
        <div className="mb-6 text-center">
          <FileCheck2 className="mx-auto mb-3 h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Check a template</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Upload a packaged InDesign template to find issues before it reaches the customer.
          </p>
        </div>
        <TemplateUploader {...props} centered />
      </div>
    </div>
  );
}

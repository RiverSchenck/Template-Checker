import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FileArchive, Loader2 } from 'lucide-react';
import { ValidationResult } from '../../types';
import countValidationIssues from '../ValidationCount';
import SuccessModal from './SuccessModal';
import FileSizeErrorModal from './FileSizeErrorModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB

interface FileUploadPageProps {
  checkerResponse: (jsonResponse: ValidationResult, setPrevious?: boolean) => void;
  setPrevious?: boolean;
  onUploadComplete?: () => void;
  seeDetails?: (value: boolean) => void;
  navigateToResults?: () => void;
}

interface CustomResponse {
  content: {
    results: ValidationResult;
  };
}

export default function FileUploadPage({
  checkerResponse,
  setPrevious = false,
  onUploadComplete,
  seeDetails,
  navigateToResults,
}: FileUploadPageProps) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFileSizeErrorModal, setShowFileSizeErrorModal] = useState(false);
  const [fileSizeError, setFileSizeError] = useState<{ fileSizeMB: string; maxSizeMB: number } | null>(null);
  const [downloadXML, setDownloadXML] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isDebug = import.meta.env.DEV;
  const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';

  const getAuthHeaders = (): Record<string, string> => {
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const headers: Record<string, string> = { 'X-Source': 'react-frontend' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const uploadEndpoint = downloadXML ? `${baseURL}/run-and-download-xml` : `${baseURL}/run`;

  const doUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setFileSizeError({ fileSizeMB, maxSizeMB });
        setShowFileSizeErrorModal(true);
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const result = await new Promise<{ ok: boolean; body: Blob | string }>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const headers = getAuthHeaders();

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                setUploadProgress(Math.round((e.loaded / e.total) * 100));
              }
            });

            xhr.addEventListener('load', () => {
              resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                body: xhr.response,
              });
            });
            xhr.addEventListener('error', () => reject(new Error('Network error')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

            xhr.open('POST', uploadEndpoint);
            xhr.responseType = downloadXML ? 'blob' : 'text';
            Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
            xhr.send(formData);
          }
        );

        setUploadProgress(100);

        if (!result.ok) {
          const errorText =
            typeof result.body === 'string' ? result.body : await (result.body as Blob).text();
          let errorMessage = 'Upload failed';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        setFile(file);

        if (downloadXML) {
          const blob = result.body as Blob;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${file.name.replace(/\.[^.]+$/, '')}_output_XML.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          toast.success('Download started');
        } else {
          const text = typeof result.body === 'string' ? result.body : await (result.body as Blob).text();
          const json = JSON.parse(text);
          const results: ValidationResult = json?.content?.results;
          checkerResponse(results, setPrevious);
          onUploadComplete?.();
          const { totalErrors, totalWarnings, totalInfos } = countValidationIssues(results);
          if (totalErrors === 0 && totalWarnings === 0 && totalInfos === 0) {
            setShowSuccessModal(true);
          } else {
            navigateToResults?.();
          }
          toast.success(`${file.name} uploaded and checked`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(message);
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [checkerResponse, setPrevious, onUploadComplete, navigateToResults, uploadEndpoint]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const item = e.dataTransfer.files[0];
      if (item?.name?.toLowerCase().endsWith('.zip')) {
        doUpload(item);
      } else if (item) {
        toast.error('Please upload a .zip file');
      }
    },
    [doUpload]
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
    <div className="w-full max-w-xl mx-auto">
      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        seeDetails={seeDetails}
        navigateToResults={navigateToResults}
      />
      {showFileSizeErrorModal && fileSizeError && (
        <FileSizeErrorModal
          open={showFileSizeErrorModal}
          onClose={() => {
            setShowFileSizeErrorModal(false);
            setFileSizeError(null);
          }}
          fileSizeMB={fileSizeError.fileSizeMB}
          maxSizeMB={fileSizeError.maxSizeMB}
        />
      )}

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Check template</CardTitle>
          <CardDescription>
            Upload a .zip template to validate. Max size 300 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`
              flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10
              transition-colors cursor-pointer
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50'}
              ${uploading ? 'pointer-events-none opacity-70' : ''}
            `}
          >
            <input
              type="file"
              accept=".zip"
              onChange={onFileInputChange}
              disabled={uploading}
              className="sr-only"
            />
            {uploading ? (
              <Loader2 className="h-12 w-12 text-purple-500 animate-spin mb-3" />
            ) : (
              <FileArchive className="h-12 w-12 text-purple-500 mb-3" />
            )}
            <span className="text-sm font-medium text-foreground">
              {uploading ? 'Checking…' : 'Drop your .zip here or click to browse'}
            </span>
            {uploading && uploadProgress != null && (
              <div className="mt-3 w-full max-w-xs">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  Uploading… {uploadProgress}%
                </span>
              </div>
            )}
          </label>

          <div className="flex items-center gap-2">
            <Checkbox
              id="download-xml"
              checked={downloadXML}
              onCheckedChange={(v) => setDownloadXML(!!v)}
            />
            <Label htmlFor="download-xml" className="text-sm font-normal cursor-pointer">
              Download XML output
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

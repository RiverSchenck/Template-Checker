import React, { useState, useEffect, useCallback, useRef } from 'react';
import { message, ConfigProvider, Progress, Alert, Spin } from 'antd';
import { useMenu } from '../MenuContext';
import { ValidationResult } from '../../types';
import '../../App.css';

interface FileUploadPageProps {
  checkerResponse: (jsonResponse: ValidationResult, setPrevious: boolean) => void;
  setPrevious?: boolean;
  onUploadComplete?: () => void;
}

interface CustomResponse {
  content: {
    results: ValidationResult;
  };
}

function FileUploadPage({ checkerResponse, setPrevious = false, onUploadComplete }: FileUploadPageProps) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef<Set<string>>(new Set());

  const { setMenuKey } = useMenu();

  const isDebug = true;
  const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';

  const getAuthHeaders = (): Record<string, string> => {
    const token = process.env.REACT_APP_AUTH_TOKEN;
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  };

  const handleUploadResults = (response: CustomResponse) => {
    const results: ValidationResult = response?.content?.results;
    checkerResponse(results, setPrevious);
    if (onUploadComplete) {
      onUploadComplete();
    }
    setMenuKey('results');
  };

  const handleUrlSubmit = useCallback(async (urlToSubmit?: string) => {
    const urlToProcess = urlToSubmit || url;

    if (!urlToProcess || !urlToProcess.trim()) {
      const errorMsg = 'Please enter a URL';
      setError(errorMsg);
      message.error(errorMsg);
      return;
    }

    const normalizedUrl = urlToProcess.trim();
    if (processingRef.current.has(normalizedUrl) || loading) {
      return;
    }

    processingRef.current.add(normalizedUrl);

    setLoading(true);
    setError(null);
    const urlEndpoint = `${baseURL}/run-from-url`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      };

      const response = await fetch(urlEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ downloadUrl: normalizedUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to process URL';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        processingRef.current.delete(normalizedUrl);
        setError(errorMessage);
        message.error(errorMessage);
        setLoading(false);
        return;
      }

      const responseData = await response.json();
      handleUploadResults(responseData);
      setLoading(false);
    } catch (error: any) {
      processingRef.current.delete(normalizedUrl);
      const errorMsg = error.message || 'An unknown error occurred';
      setError(errorMsg);
      message.error(errorMsg);
      console.error(error);
      setLoading(false);
    }
  }, [handleUploadResults, setMenuKey, loading, url, baseURL, getAuthHeaders]);

  const processUrl = useCallback((receivedUrl: string) => {
    if (receivedUrl) {
      setUrl(receivedUrl);
      setError(null);
      setMenuKey('upload-template');
      handleUrlSubmit(receivedUrl);
    }
  }, [setMenuKey, handleUrlSubmit]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get('pendingFrontifyUrl').then((result) => {
        if (result.pendingFrontifyUrl && !loading) {
          chrome.storage.local.remove('pendingFrontifyUrl').then(() => {
            processUrl(result.pendingFrontifyUrl);
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.action === 'frontifyUrlReceived') {
        processUrl(message.url);
        sendResponse({ success: true });
        return true;
      }
      return false;
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [processUrl]);

  return (
    <div style={{ width: '50%', height: '25%' }}>
      <ConfigProvider
        theme={{
          token: {
            fontFamily: 'Space Grotesk Frontify',
            colorPrimaryHover: '#9A7EFE',
            colorFillAlter: '#EAEBEB',
            colorBorder: "#CBBBFB",
          },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Spin size="large" style={{ color: '#7C57FF' }} />
              <div style={{ textAlign: 'center', color: '#666', fontFamily: 'Space Grotesk Frontify', fontSize: '16px' }}>
                Processing URL...
              </div>
              <Progress
                percent={100}
                status="active"
                showInfo={false}
                strokeColor={{
                  '0%': '#7C57FF',
                  '100%': '#9A7EFE',
                }}
                style={{ width: '300px' }}
              />
            </div>
          )}
          {error && !loading && (
            <Alert
              message="Error"
              description={error}
              type="error"
              closable
              onClose={() => setError(null)}
              style={{ fontFamily: 'Space Grotesk Frontify', maxWidth: '500px' }}
            />
          )}
          {!loading && !error && (
            <div style={{ textAlign: 'center', color: '#999', fontFamily: 'Space Grotesk Frontify', fontSize: '14px' }}>
              Click "Checker" on Frontify to process a template
            </div>
          )}
        </div>
      </ConfigProvider>
    </div>
  );
}

export default FileUploadPage;

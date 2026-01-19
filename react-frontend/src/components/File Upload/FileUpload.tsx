import React, { useState, useEffect } from 'react';
import { Upload, message, ConfigProvider } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { Checkbox } from 'antd';
import { UploadChangeParam, UploadFile } from 'antd/es/upload/interface';
import { useMenu } from '../MenuContext';
import { ValidationResult } from '../../types';
import countValidationIssues from '../ValidationCount';
import SuccessModal from './SuccessModal';
import FileSizeErrorModal from './FileSizeErrorModal';
import '../../App.css';


const { Dragger } = Upload;

// Maximum file size: 300MB (matching backend limit)
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB in bytes

interface FileUploadPageProps {
  checkerResponse: (jsonResponse: ValidationResult, setPrevious: boolean) => void;
  setPrevious?: boolean;
  onUploadComplete?: () => void;
  seeDetails?: (value: Boolean) => void
}

interface CustomResponse {
  content: {
    results: ValidationResult;
  };
}

function FileUploadPage({ checkerResponse, setPrevious = false, onUploadComplete, seeDetails }: FileUploadPageProps) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFileSizeErrorModal, setShowFileSizeErrorModal] = useState(false);
  const [fileSizeError, setFileSizeError] = useState<{ fileSizeMB: string; maxSizeMB: number } | null>(null);

  const { setMenuKey } = useMenu();
  const [downloadXML, setDownloadXML] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Use production URL when NODE_ENV is 'production', otherwise use localhost for development
  const isDebug = process.env.NODE_ENV !== 'production';
  const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';

  // Get auth token from environment variable
  const getAuthHeaders = (): Record<string, string> => {
    const token = process.env.REACT_APP_AUTH_TOKEN;
    const headers: Record<string, string> = {
      'X-Source': 'react-frontend'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);  // Ensure this function truly resets the modal's visibility state
  };

  const handleCloseFileSizeErrorModal = () => {
    setShowFileSizeErrorModal(false);
    setFileSizeError(null);
  };

  const handleDownload = async (fileName: string) => {
    const downloadEndpoint = `${baseURL}/run-and-download-xml`;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(downloadEndpoint, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to download the ZIP file');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${fileName.split('.')[0]}_output_XML.zip`; // Dynamically naming based on the uploaded file
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error: any) {
        message.error(error.message || "An unknown error occurred");
        console.error(error);
      }
    }
  };

  const handleUploadResults = (response: CustomResponse) => {
    const results: ValidationResult = response?.content?.results;
    console.log(results);
    checkerResponse(results, setPrevious); // Pass results back up for further processing
    if (onUploadComplete) {
      onUploadComplete();
    }
    const { totalErrors, totalWarnings, totalInfos } = countValidationIssues(results);
    if (totalErrors === 0 && totalWarnings === 0 && totalInfos === 0) {
      setShowSuccessModal(true);
    } else {
      setMenuKey('results');
    }
  };

  const beforeUpload = (file: File) => {
    // Validate file size before upload
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setFileSizeError({ fileSizeMB, maxSizeMB });
      setShowFileSizeErrorModal(true);
      return Upload.LIST_IGNORE; // Prevent file from being added to the upload list
    }
    return true; // Allow upload
  };

  const handleFileChange = (info: UploadChangeParam<UploadFile<any>>) => {
    const { status, response, originFileObj, name: fileName } = info.file;

    if (status === 'done') {
      message.success(`${fileName} file uploaded successfully`);
      setFile(originFileObj as File);
      if (response) {
        if (downloadXML) {
          // When downloadXML is true, response should be a blob from customRequest
          if (response instanceof Blob) {
            const downloadUrl = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${fileName.split('.')[0]}_output_XML.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
          } else {
            // Fallback: if somehow we got JSON, make the download request
            handleDownload(fileName);
          }
        } else {
          handleUploadResults(response);
        }
      }
    } else if (status === 'error') {
      message.error(`${fileName} file upload failed. ${info.file.error?.message || 'Unknown error'}`);
    }
  };

  const uploadEndpoint = downloadXML ? `${baseURL}/run-and-download-xml` : `${baseURL}/run`;

  // Custom request handler to properly handle authentication headers and both JSON/blob responses
  const customRequest = async (options: any) => {
    const { onSuccess, onError, file } = options;

    const formData = new FormData();
    formData.append('file', file as File);

    try {
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Upload failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        onError(new Error(errorMessage));
        return;
      }

      if (downloadXML) {
        // For download, get the blob and pass it to onSuccess
        const blob = await response.blob();
        onSuccess(blob, response);
      } else {
        // For regular upload, get JSON
        const json = await response.json();
        onSuccess(json, response);
      }
    } catch (error: any) {
      onError(error);
    }
  };

  return (
    <div style={{ width: '50%', height: '25%' }}>
      <>
        {showSuccessModal && (
          <SuccessModal
            visible={showSuccessModal}
            onClose={handleCloseModal}
            seeDetails={seeDetails}
          />
        )}
        {showFileSizeErrorModal && fileSizeError && (
          <FileSizeErrorModal
            visible={showFileSizeErrorModal}
            onClose={handleCloseFileSizeErrorModal}
            fileSizeMB={fileSizeError.fileSizeMB}
            maxSizeMB={fileSizeError.maxSizeMB}
          />
        )}
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
          <Dragger
            action={undefined}
            customRequest={customRequest}
            onChange={handleFileChange}
            beforeUpload={beforeUpload}
            multiple={false}
            accept=".zip"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#7C57FF' }} />
            </p>
            <p className="ant-upload-text">Click or drag template to this area to upload</p>
          </Dragger>
          <Checkbox
            checked={downloadXML}
            onChange={(e) => setDownloadXML(e.target.checked)}
          >
            Download XML?
          </Checkbox>
        </ConfigProvider>
      </>
    </div>
  );
}

export default FileUploadPage;

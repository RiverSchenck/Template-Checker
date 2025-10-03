import React, { useState } from 'react';
import { Upload, message, ConfigProvider } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { Checkbox } from 'antd';
import { UploadChangeParam, UploadFile } from 'antd/es/upload/interface';
import { useMenu } from '../MenuContext';
import { ValidationResult } from '../../types';
import countValidationIssues from '../ValidationCount';
import SuccessModal from './SuccessModal';
import ConfirmationPopup from './ConfirmationPopup';
import '../../App.css';


const { Dragger } = Upload;

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
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { setMenuKey } = useMenu();
  const [downloadXML, setDownloadXML] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleCloseModal = () => {
    setShowSuccessModal(false);  // Ensure this function truly resets the modal's visibility state
  };

  const handleDownload = async (fileName: string) => {
    const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';
    const downloadEndpoint = `${baseURL}/run-and-download-xml`;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(downloadEndpoint, {
          method: 'POST',
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

  const handleFileChange = (info: UploadChangeParam<UploadFile<any>>) => {
    const { status, response, originFileObj, name: fileName } = info.file;

    if (status === 'done') {
      message.success(`${fileName} file uploaded successfully`);
      setFile(originFileObj as File);
      if (response) {
        if (downloadXML) {
          handleDownload(fileName);
        } else {
          handleUploadResults(response);
        }
      }
    } else if (status === 'error') {
      message.error(`${fileName} file upload failed. ${info.file.error.message}`);
    }
  };


  const isDebug = true; 

  const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';
  const uploadEndpoint = downloadXML ? `${baseURL}/run-and-download-xml` : `${baseURL}/run`;
  return (
    <div style={{ width: '50%', height: '25%' }}>
      {!isConfirmed && (
        <ConfirmationPopup onConfirm={() => setIsConfirmed(true)} />
      )}
        <>
          {showSuccessModal && <SuccessModal onClose={handleCloseModal} seeDetails={seeDetails} />}
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
              action={uploadEndpoint}
              onChange={handleFileChange}
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

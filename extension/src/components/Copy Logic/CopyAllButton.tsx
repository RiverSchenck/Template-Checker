import React from 'react';
import { Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { ValidationResult } from '../../types';
import { buildReport } from './CopyLogic';
import CreatePDF from '../../PDF Report/CreateReport';
import { PDFDownloadLink } from '@react-pdf/renderer';

type CopyAllProps = {
    jsonResponse: ValidationResult;
}

export function CopyAll({ jsonResponse }: CopyAllProps) {
  const handleCopy = () => {
    //createPDF(jsonResponse)
  };
  
  
  return (
      <PDFDownloadLink document={<CreatePDF jsonResponse={jsonResponse} />} fileName="validation-report.pdf">
        {({ blob, url, loading, error }) => (
          <Button icon={<CopyOutlined />} disabled={loading}>
            {loading ? 'Loading document...' : 'Create PDF Report'}
          </Button>
        )}
      </PDFDownloadLink>
  );
}

export default CopyAll;

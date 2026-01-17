import React from 'react';
import { Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { ValidationResult } from '../../types';
import { buildReport } from './CopyLogic';

type CopyButtonProps = {
    jsonResponse: ValidationResult;
    specificKey?: keyof ValidationResult;
}

export function CopyButton({ jsonResponse, specificKey }: CopyButtonProps) {
  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); //Stop collapse from opening
    const report = buildReport(jsonResponse, specificKey);
    navigator.clipboard.writeText(report).then(() => {
      message.success("Copied report to clipboard!");
    }, () => {
      message.error("Failed to copy report.");
    });
  };
  
  
  return (
    <Button onClick={handleCopy} size='small' type='primary' style={{zIndex: '999'}} icon={<CopyOutlined />}>
    </Button>
  );
}

export default CopyButton;

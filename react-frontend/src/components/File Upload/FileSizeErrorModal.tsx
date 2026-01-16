import React from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import '../../App.css';

interface FileSizeErrorModalProps {
  visible: boolean;
  onClose: () => void;
  fileSizeMB: string;
  maxSizeMB: number;
}

const FileSizeErrorModal = ({ visible, onClose, fileSizeMB, maxSizeMB }: FileSizeErrorModalProps) => {
  return (
    <Modal
      title="File Size Too Large"
      open={visible}
      onOk={onClose}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      style={{ left: '80px' }}
    >
      <Typography.Paragraph>
        The file you attempted to upload is too large.
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space align="center">
          <WarningOutlined style={{ color: '#faad14' }} />
          <Typography.Text>
            File size: <strong>{fileSizeMB}MB</strong>
          </Typography.Text>
        </Space>
        <Space align="center">
          <WarningOutlined style={{ color: '#faad14' }} />
          <Typography.Text>
            Maximum allowed size: <strong>{maxSizeMB}MB</strong>
          </Typography.Text>
        </Space>
      </Space>
      <Typography.Paragraph style={{ marginTop: '16px', marginBottom: 0 }}>
        Pro tip: Delete some of the massive files in the 'links' then reupload, and ignore the missing image errors.
      </Typography.Paragraph>
    </Modal>
  );
};

export default FileSizeErrorModal;

import React, { useState } from 'react';
import { Button, Modal } from 'antd';
import { RedoOutlined } from '@ant-design/icons';
import FileUploadPage from '../File Upload/FileUpload';
import { ValidationResult } from '../../types';

interface ReuploadButtonProps {
  checkerResponse: (jsonResponse: ValidationResult) => void;
}

function ReuploadButton({ checkerResponse }: ReuploadButtonProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleUploadComplete = () => {
    setIsModalVisible(false);  // This will close the modal when the upload is complete
  };

  return (
    <>
      <Button
        onClick={showModal}
        type='primary'
        style={{
          fontSize: '12px',
          padding: '4px 10px',
          height: 'auto',
          lineHeight: 'normal',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '10px'
        }}
      >
        <RedoOutlined/> Reupload and Compare
      </Button>
      <Modal
        title="Upload New File"
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={null} // Removes default buttons
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <FileUploadPage
            checkerResponse={checkerResponse}
            setPrevious={true}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      </Modal>
    </>
  );
}

export default ReuploadButton;

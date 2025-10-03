import React, { useEffect, useState } from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { triggerConfettiCelebration } from './Confetti';
import { useMenu } from '../MenuContext';
import '../../App.css';


interface SuccessModalProps {
  onClose: () => void;
  seeDetails?: (value: Boolean) => void
}

const SuccessModal = ({onClose, seeDetails}: SuccessModalProps) => {
  const [isVisible, setIsVisible] = useState(true);  // Control visibility internally
  const { setMenuKey } = useMenu();

  useEffect(() => {
    if (isVisible) {
      triggerConfettiCelebration();
    }
  }, [isVisible]);

  const handleSeeDetails = () => {
    if (seeDetails) {
      seeDetails(true);
      setMenuKey('results');  // Change the menu key to show results
      onClose();  // Optionally close the modal
    }
  };

  return (
    <Modal
      title="Template Champion!"
      visible={true}  // Controlled by component's own state
      onOk={onClose}
      onCancel={onClose}
      footer={[
        seeDetails && (
          <Button key="details" type="default" onClick={handleSeeDetails}>
            See Details
          </Button>
        ),
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      style={{ left: '80px' }}
    >
      <Typography.Paragraph>
        Congratulations! No errors or warnings detected.
      </Typography.Paragraph>
      <Space align="center">
        <InfoCircleOutlined />
        <Typography.Text>Unchecked issues are still possible.</Typography.Text>
      </Space>
    </Modal>
  );
};

export default SuccessModal;
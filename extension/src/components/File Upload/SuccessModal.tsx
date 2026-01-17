import React, { useEffect } from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { triggerConfettiCelebration } from './Confetti';
import { useMenu } from '../MenuContext';
import '../../App.css';


interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

const SuccessModal = ({ visible, onClose }: SuccessModalProps) => {
  const { setMenuKey } = useMenu();

  useEffect(() => {
    if (visible) {
      triggerConfettiCelebration();
    }
  }, [visible]);

  const handleSeeDetails = () => {
    setMenuKey('results');  // Change the menu key to show results
    onClose();  // Optionally close the modal
  };

  return (
    <Modal
      title="Template Champion!"
      open={visible}
      onOk={onClose}
      onCancel={onClose}
      footer={[
        <Button key="details" type="default" onClick={handleSeeDetails}>
          See Details
        </Button>,
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

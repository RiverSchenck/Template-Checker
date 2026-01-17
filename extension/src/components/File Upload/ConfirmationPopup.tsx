import React, { useState, useEffect } from 'react';
import { Checkbox, Button, Modal, Typography } from 'antd';

const { Text } = Typography;

interface ConfirmationPopupProps {
  onConfirm: () => void;
}

const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({ onConfirm }) => {
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);
  const [isPopupVisible, setIsPopupVisible] = useState(true);

  const handleConfirm = () => {
    const timestamp = new Date().getTime();
    localStorage.setItem('confirmationTimestamp', timestamp.toString());
    setIsPopupVisible(false);
    onConfirm();
  };

  useEffect(() => {
    const lastConfirmed = localStorage.getItem('confirmationTimestamp');
    if (lastConfirmed) {
      const now = new Date().getTime();
      const reconfDays = 2;
      const dayCount = 24 * 60 * 60 * 1000 * reconfDays;
      if (now - parseInt(lastConfirmed) < dayCount) {
        setIsPopupVisible(false);
      }
    }
  }, []);

  return (
    <Modal
      visible={isPopupVisible}
      title="Acknowledgement Required"
      footer={null}
      closable={false}
      centered
    >
      <div style={{ marginBottom: '20px', color: '#888' }}>
      <Text style={{ fontSize: '12px' }}>
          I know these acknowledgments are annoying but I want to make sure expectations surrounding the template checker are set. Resets every 48 hours.
        </Text>
      </div>
      <div>
        <Checkbox checked={checked1} onChange={(e) => setChecked1(e.target.checked)}>
            <Text style={{ fontSize: '14px' }}>
                I understand this is a workaround <strong>NOT A SOLUTION</strong>.
            </Text>
        </Checkbox>
        <br />
        <Checkbox checked={checked2} onChange={(e) => setChecked2(e.target.checked)}>
            <Text style={{ fontSize: '14px' }}>
                I understand this is River's weekend project and <strong>not a Frontify sponsored Template Checker.</strong>
            </Text>
        </Checkbox>
        <br />
        <Checkbox checked={checked3} onChange={(e) => setChecked3(e.target.checked)}>
            <Text style={{ fontSize: '14px' }}>
                I understand there is <strong>no expectation of maintenance</strong>.
            </Text>
        </Checkbox>
        <br />
        <Button
          type="primary"
          onClick={handleConfirm}
          disabled={!checked1 || !checked2 || !checked3}
          style={{ marginTop: '10px' }}
        >
          Continue
        </Button>
      </div>
      <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#888', textAlign: 'center' }}>
        <Text style={{ fontSize: '12px' }}>
            <i>PS: If the template checker saved your day, feel free to send a beer my way</i> 😉 <br />
            <i>Cheers to debugging</i>🍺<i> - River</i>
        </Text>
      </div>
    </Modal>
  );
};

export default ConfirmationPopup;

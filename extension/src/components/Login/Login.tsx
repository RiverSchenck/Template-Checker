import { useEffect } from 'react';
import { Button, ConfigProvider, Typography } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { openLoginTab } from '../../utils/auth';
import '../../App.css';

const { Text } = Typography;

export default function Login() {
  useEffect(() => {
    openLoginTab();
  }, []);

  const handleSignIn = () => {
    openLoginTab();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #16213e 100%)',
    }}>
      <ConfigProvider
        theme={{
          token: {
            fontFamily: 'Space Grotesk Frontify',
            colorPrimary: '#B39DFD',
            colorLink: '#9A7EFE',
          },
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, color: '#fff', marginBottom: 8 }}>
            Template Checker
          </div>
          <Text style={{ color: '#b8b8d1', fontSize: 14 }}>
            Sign in to validate Frontify templates
          </Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<GoogleOutlined />}
          onClick={handleSignIn}
          style={{ minWidth: 220 }}
        >
          Sign in with Google
        </Button>
        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
          A browser tab will open to sign in; you’ll return to the extension when done.
        </Text>
      </ConfigProvider>
    </div>
  );
}

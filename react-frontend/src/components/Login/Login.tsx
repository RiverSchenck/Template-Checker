import { useState } from 'react';
import { Button, Checkbox, Typography, Card, ConfigProvider } from 'antd';
import { useAuth } from '../AuthContext';
import { GoogleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function Login() {
  const { signInWithGoogle, loading } = useAuth();
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);

  const canSignIn = checked1 && checked2 && checked3;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #16213e 100%)',
      backgroundSize: 'cover'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '540px',
          borderRadius: '16px',
          background: 'rgba(20, 20, 20, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
        }}
        bodyStyle={{ padding: '48px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 300,
            letterSpacing: '3px',
            color: '#ffffff',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            Template Checker
          </div>
          <Text style={{ color: '#b8b8d1', fontSize: '14px', fontWeight: 400 }}>
            Validate and check Frontify templates
          </Text>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{
            marginBottom: '28px',
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px'
          }}>
            <Text style={{ fontSize: '13px', color: '#aaaaaa', fontStyle: 'italic', lineHeight: '1.6' }}>
              I know these acknowledgments are annoying but I want to make sure expectations surrounding the template checker are set.
            </Text>
          </div>

          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#9c7dff',
              },
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              marginBottom: '28px'
            }}>
              <Checkbox
                checked={checked1}
                onChange={(e) => setChecked1(e.target.checked)}
                style={{
                  alignItems: 'flex-start',
                  color: '#e0e0e8'
                }}
              >
                <Text style={{ fontSize: '14px', lineHeight: '1.6', color: '#cccccc' }}>
                  I understand this is a workaround <strong style={{ color: '#ffffff', fontWeight: 600 }}>NOT A SOLUTION</strong>.
                </Text>
              </Checkbox>

              <Checkbox
                checked={checked2}
                onChange={(e) => setChecked2(e.target.checked)}
                style={{ alignItems: 'flex-start' }}
              >
                <Text style={{ fontSize: '14px', lineHeight: '1.6', color: '#cccccc' }}>
                  I understand this is River's weekend project and <strong style={{ color: '#ffffff', fontWeight: 600 }}>not a Frontify sponsored Template Checker.</strong>
                </Text>
              </Checkbox>

              <Checkbox
                checked={checked3}
                onChange={(e) => setChecked3(e.target.checked)}
                style={{ alignItems: 'flex-start' }}
              >
                <Text style={{ fontSize: '14px', lineHeight: '1.6', color: '#cccccc' }}>
                  I understand there is <strong style={{ color: '#ffffff', fontWeight: 600 }}>no expectation of maintenance</strong>.
                </Text>
              </Checkbox>
            </div>
          </ConfigProvider>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<GoogleOutlined />}
          loading={loading}
          onClick={signInWithGoogle}
          disabled={!canSignIn}
          block
          style={{
            height: '48px',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 500,
            background: canSignIn
              ? 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: canSignIn ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            color: canSignIn ? '#000000' : 'rgba(255, 255, 255, 0.3)',
            boxShadow: canSignIn ? '0 4px 15px rgba(255, 255, 255, 0.2)' : 'none',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            if (canSignIn) {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (canSignIn) {
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          Sign in with Google
        </Button>

        <div style={{
          marginTop: '32px',
          paddingTop: '28px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: '12px', color: '#888888', fontStyle: 'italic', lineHeight: '1.8' }}>
            PS: If the template checker saved your day, feel free to send a beer <span style={{ whiteSpace: 'nowrap' }}>my way 😉</span>
            <br />
            Cheers to debugging🍺 - River
          </Text>
        </div>
      </Card>
    </div>
  );
}

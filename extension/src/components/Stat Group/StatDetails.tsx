import React, { useState } from 'react';
import { Row, Col, Button, Statistic, Rate, Progress, Typography, Divider } from 'antd';
import { UpOutlined, DownOutlined } from '@ant-design/icons';
import { ValidationResult, ValidationCategory, CategoryDetail } from '../../types';

const { Text } = Typography

// Define the types for the props
interface StatsToggleProps {
  jsonResponse: ValidationResult;
}

interface StatisticColumnProps {
  title: string;
  value: number;
  suffix: number;
}


function StatisticColumn({ title, value, suffix }: StatisticColumnProps) {
  value = Math.max(0, suffix - value); //Don't be less than 0. Unused images etc can make it negative
  const percentage = suffix > 0 ? ((value / suffix) * 100) : 0;
  const textColor = percentage === 100 ? '#9A7EFE' : 'rgba(0, 0, 0, 0.45)';
  return (
    <Col style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      minHeight: '140px'
    }}>
      <Text
        type='secondary'
        style={{
          marginBottom: '8px',
          fontSize: '14px',
          textAlign: 'center',
          lineHeight: '1.4',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'normal',
          wordBreak: 'break-word'
        }}
      >
        {`Correct ${title}'s`}
      </Text>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Progress
          type="circle"
          percent={Math.round(percentage)}
          format={() => (
            <Text type='secondary' style={{ color: textColor, fontSize: '12px' }}>
              {`${value} / ${suffix}`}
            </Text>
          )}
          strokeColor={'#9A7EFE'}
          size={'small'}
          strokeWidth={8}
        />
      </div>
      {/* <Rate
                disabled
                allowHalf
                value={rateValue}
                style={{ fontSize: 13, width: '100%', justifyContent: 'center', textAlign: 'center', marginTop:'3px' }}
            /> */}
    </Col>
  );
}

function calculateTotalIssuesFromCategory(categoryData?: CategoryDetail): number {
  if (categoryData && categoryData.details) {
    // Return the number of keys in the details object
    return Object.keys(categoryData.details).length;
  }
  return 0;
}



const defaultKeys: (keyof ValidationResult)[] = [
  'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images'
];


function StatsToggle({ jsonResponse }: StatsToggleProps) {
  const [showStats, setShowStats] = useState(false);

  const generateStatistics = (key: keyof ValidationResult, index: number): JSX.Element => {
    const categoryData = jsonResponse[key] as CategoryDetail;
    const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
    const totalIssues = calculateTotalIssuesFromCategory(categoryData);
    const total_count = categoryData ? categoryData.total_count : 0;
    const title = categoryEnum || 'Unknown Category';

    return (
      <><Col key={`${title}-${index}`} xs={24} sm={12} md={8} lg={6} xl={4} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '140px',
        position: 'relative'
      }}>
        <StatisticColumn title={title} value={totalIssues} suffix={total_count} />
      </Col><Col>
          {index !== defaultKeys.length - 1 && <Divider type="vertical" style={{ height: '100%', position: 'absolute', right: 0, top: 0 }} />}
        </Col></>
    );
  };


  return (
    <>
      {showStats &&
        <Row gutter={[16, 16]} style={{ width: '100%', display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ marginBottom: 16, width: '100%', backgroundColor: '#FAFAFA', marginTop: '10px' }}>
            <Row gutter={[16, 16]} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              {defaultKeys.map(generateStatistics)}
            </Row>
          </div>
        </Row>
      }
      <Button
        onClick={() => setShowStats(!showStats)}
        style={{
          fontSize: '10px',
          padding: '2px 8px',
          paddingBottom: '0px',
          height: '20px',
          lineHeight: 'normal',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '50px',
        }}
      >
        {showStats ? <UpOutlined style={{ fontSize: '9px' }} /> : <DownOutlined style={{ fontSize: '9px' }} />}
      </Button>
    </>
  );
}

export default StatsToggle;


import React, {useState, useEffect} from 'react';
import { Row, Col, Button, Statistic, Rate, Progress, Typography, Divider } from 'antd';
import { UpOutlined, DownOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined } from '@ant-design/icons';
import { ValidationResult, ValidationCategory, CategoryDetail } from '../../types';

const { Text } = Typography

// Define the types for the props
interface StatsToggleProps {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  seeDetails?: Boolean;
}

interface StatisticColumnProps {
    title: string;
    value: number;
    suffix: number;
  }
  
  
  function StatisticColumn({ title, value, suffix }: StatisticColumnProps) {
    value = Math.max(0, suffix - value); //Don't be less than 0. Unused images etc can make it negative
    const percentage = suffix > 0 ? ((value / suffix) * 100) : 0;
    const textColor = percentage === 100 ? '#9A7EFE': 'rgba(0, 0, 0, 0.45)';
    return (
        <Col style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Text type='secondary' style={{marginBottom: '5px', fontSize: '14px'}}>{`Correct ${title}'s`}</Text>
            <Progress
                type="circle"
                percent={Math.round(percentage)}
                format={() => <Text type='secondary' style={{color: textColor}}>{`${value} / ${suffix}`}</Text>}  // Show fraction instead of percentage
                strokeColor={'#9A7EFE'}
                size={'small'}
            />
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

    const calculateChange = (current: number, previous: number) => {
        if (previous === undefined) {
          return 0; 
        }
        return ( current - previous);
      };

      const getChangeDetails = (change: number) => {
        if (change > 0) {
          return { color: '#cf1322', icon: <ArrowUpOutlined /> }; // Red, Arrow Up
        } else if (change < 0) {
          return { color: '#3f8600', icon: <ArrowDownOutlined /> }; // Green, Arrow Down
        } else {
          return { color: '#d9d9d9', icon: <SwapOutlined /> }; // Gray, Swap
        }
      };
      
      
  const defaultKeys: (keyof ValidationResult)[] = [
    'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images'
  ];


function StatsToggle({ jsonResponse, previousJsonResponse, seeDetails }: StatsToggleProps) {
    const [showStats, setShowStats] = useState(!!previousJsonResponse || !!seeDetails);

    useEffect(() => {
        if (previousJsonResponse || seeDetails) {
            setShowStats(true);
        }
    }, [previousJsonResponse, seeDetails]);

    const generateStatistics = (key: keyof ValidationResult, index: number): JSX.Element => {
        const categoryData = jsonResponse[key] as CategoryDetail;
        const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
        const totalIssues = calculateTotalIssuesFromCategory(categoryData);
        const total_count = categoryData ? categoryData.total_count : 0;
        const title = categoryEnum || 'Unknown Category';
      
        return (
            <><Col key={`${title}-${index}`} xs={24} sm={12} md={8} lg={6} xl={4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <StatisticColumn title={title} value={totalIssues} suffix={total_count} />
            {previousJsonResponse && renderChangeStatistics(key, totalIssues)}
          </Col><Col>
              {index !== defaultKeys.length - 1 && <Divider type="vertical" style={{ height: '100%', position: 'absolute', right: 0, top: 0 }} />}
            </Col></>
        );
      };
    
      const renderChangeStatistics = (key: keyof ValidationResult, totalIssues: number): JSX.Element | null => {
        // Use optional chaining to safely access the details
        const previousCategoryData = previousJsonResponse?.[key] as CategoryDetail | undefined;
      
        // Check if previousCategoryData exists before proceeding
        if (previousCategoryData) {
          const previousTotalIssues = calculateTotalIssuesFromCategory(previousCategoryData);
          console.log("Previous Total:",previousTotalIssues)
          console.log("Total:",totalIssues)
          const difference = calculateChange(totalIssues, previousTotalIssues);
          const { color, icon } = getChangeDetails(difference);
      
          return (
            <div style={{marginTop: '10px'}}>
                <Text type='secondary' style={{fontSize: '11px'}}>Change from Previous:</Text>
                <Statistic
                    value={Math.abs(difference)}
                    precision={2}
                    valueStyle={{ color, fontSize: '20px' }}
                    prefix={icon}
                    // suffix="%"
                    style={{ textAlign: 'center' }} />
            </div>
          );
        }
        // Return null or render nothing if there is no previous data
        return null;
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
                {showStats ? <UpOutlined style={{ fontSize: '9px'}} /> : <DownOutlined style={{ fontSize: '9px'}} />}
            </Button>
        </>
    );
    }
    
    export default StatsToggle;


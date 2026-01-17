import React from 'react';
import { Card, Row, Col, Typography, Statistic, Divider } from 'antd';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { ValidationResult } from '../../types';
import countValidationIssues from '../ValidationCount'
import StatsToggle from './StatDetails';

const { Title } = Typography;

type ValidationStatsProps = {
  jsonResponse: ValidationResult;
  checkerResponse: (jsonResponse: ValidationResult) => void;
};

function ValidationStats({ jsonResponse, checkerResponse }: ValidationStatsProps) {
  const templateName = jsonResponse.template_name;
  const { totalErrors, totalWarnings, totalInfos } = countValidationIssues(jsonResponse)


  return (
    <Card
      title={
        <Title level={5} style={{ textAlign: 'left', marginBottom: 0 }}>{templateName}</Title>
      }
      bordered
      style={{
        backgroundColor: '#FAFAFA',
        border: `1px solid #EAEBEB`,
        borderRadius: '0px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        marginTop: 0,
        marginBottom: 0,
      }}
      size="small"
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
        <Row gutter={10} justify="space-around" align="middle" style={{ minHeight: '60px', maxWidth: '50%', textAlign: 'center', width: '100%', marginBottom: '15px' }}>
          <Col>
            <Statistic
              title="Errors"
              value={totalErrors}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Divider type="vertical" style={{ height: '60px' }} />
          <Col>
            <Statistic
              title="Warnings"
              value={totalWarnings}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Divider type="vertical" style={{ height: '60px' }} />
          <Col>
            <Statistic
              title="Infos"
              value={totalInfos}
              valueStyle={{ color: '#0096FF' }}
            />
          </Col>
        </Row>
        <StatsToggle jsonResponse={jsonResponse} />
      </div>
    </Card>
  );
}

export default ValidationStats;

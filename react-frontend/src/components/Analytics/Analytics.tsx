import React, { useState, useEffect } from 'react';
import { Card, Statistic, Table, Tag, Space, Select, Spin, Alert, Row, Col } from 'antd';
import {
  FileDoneOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import '../../App.css';

const { Option } = Select;

interface AnalyticsSummary {
  summary: {
    total_runs: number;
    total_errors: number;
    total_warnings: number;
    total_infos: number;
    avg_duration_ms: number;
    avg_file_size_bytes: number;
    days: number;
  };
  source_types: {
    [key: string]: {
      count: number;
      total_errors: number;
      total_warnings: number;
      total_infos: number;
    };
  };
  all_validations: Array<{
    type: string;
    severity: string;
    count: number;
  }>;
  runs_over_time: Array<{
    date: string;
    runs: number;
    errors: number;
    warnings: number;
    infos: number;
  }>;
  recent_runs: Array<any>;
}

const isDebug = true;
const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';

const getAuthHeaders = (): Record<string, string> => {
  const token = process.env.REACT_APP_AUTH_TOKEN;
  const headers: Record<string, string> = {
    'X-Source': 'react-frontend'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseURL}/analytics/summary?days=${days}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'red';
      case 'warning':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getSourceTypeLabel = (source: string) => {
    switch (source) {
      case 'react-frontend':
        return 'React Frontend';
      case 'extension':
        return 'Extension';
      case 'api':
        return 'API';
      default:
        return source;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <Alert
          message="Error Loading Analytics"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const columns = [
    {
      title: 'Validation Type',
      dataIndex: 'type',
      key: 'type',
      filters: data?.all_validations
        ? Array.from(new Set(data.all_validations.map((v: any) => v.type)))
            .map((type: string) => ({ text: type, value: type }))
        : [],
      onFilter: (value: any, record: any) => record.type === value,
      filterSearch: true,
      sorter: (a: any, b: any) => a.type.localeCompare(b.type),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      filters: [
        { text: 'Error', value: 'error' },
        { text: 'Warning', value: 'warning' },
        { text: 'Info', value: 'info' },
      ],
      onFilter: (value: any, record: any) => record.severity === value,
      sorter: (a: any, b: any) => a.severity.localeCompare(b.severity),
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>{severity.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
      defaultSortOrder: 'descend' as const,
    },
  ];

  const runColumns = [
    {
      title: 'Template Name',
      dataIndex: 'template_name',
      key: 'template_name',
      sorter: (a: any, b: any) => (a.template_name || '').localeCompare(b.template_name || ''),
    },
    {
      title: 'Source',
      dataIndex: 'source_type',
      key: 'source_type',
      sorter: (a: any, b: any) => (a.source_type || '').localeCompare(b.source_type || ''),
      render: (source: string) => getSourceTypeLabel(source),
    },
    {
      title: 'Errors',
      dataIndex: 'total_errors',
      key: 'total_errors',
      sorter: (a: any, b: any) => a.total_errors - b.total_errors,
      render: (count: number) => <span style={{ color: count > 0 ? '#ff4d4f' : undefined }}>{count}</span>,
    },
    {
      title: 'Warnings',
      dataIndex: 'total_warnings',
      key: 'total_warnings',
      sorter: (a: any, b: any) => a.total_warnings - b.total_warnings,
      render: (count: number) => <span style={{ color: count > 0 ? '#faad14' : undefined }}>{count}</span>,
    },
    {
      title: 'Infos',
      dataIndex: 'total_infos',
      key: 'total_infos',
      sorter: (a: any, b: any) => a.total_infos - b.total_infos,
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      sorter: (a: any, b: any) => a.duration_ms - b.duration_ms,
      render: (ms: number) => formatDuration(ms),
    },
    {
      title: 'File Size',
      dataIndex: 'file_size_bytes',
      key: 'file_size_bytes',
      sorter: (a: any, b: any) => a.file_size_bytes - b.file_size_bytes,
      render: (bytes: number) => formatFileSize(bytes),
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      sorter: (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      defaultSortOrder: 'descend' as const,
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
  ];

  return (
    <div style={{ padding: '24px', paddingTop: '48px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'Space Grotesk Frontify' }}>Analytics</h1>
        <Select
          value={days}
          onChange={setDays}
          style={{ width: 150 }}
        >
          <Option value={7}>Last 7 days</Option>
          <Option value={30}>Last 30 days</Option>
          <Option value={90}>Last 90 days</Option>
          <Option value={365}>Last year</Option>
        </Select>
      </div>

      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Runs"
              value={data.summary.total_runs}
              prefix={<FileDoneOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Errors"
              value={data.summary.total_errors}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Warnings"
              value={data.summary.total_warnings}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Infos"
              value={data.summary.total_infos}
              prefix={<InfoCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={12}>
          <Card>
            <Statistic
              title="Average Duration"
              value={formatDuration(data.summary.avg_duration_ms)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12}>
          <Card>
            <Statistic
              title="Average File Size"
              value={formatFileSize(data.summary.avg_file_size_bytes)}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Runs Over Time */}
        <Col xs={24} lg={12}>
          <Card title="Runs Over Time" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.runs_over_time || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="runs"
                  stroke="#7C57FF"
                  strokeWidth={2}
                  name="Runs"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Errors/Warnings/Infos Over Time */}
        <Col xs={24} lg={12}>
          <Card title="Issues Over Time" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.runs_over_time || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="errors"
                  stroke="#ff4d4f"
                  strokeWidth={2}
                  name="Errors"
                />
                <Line
                  type="monotone"
                  dataKey="warnings"
                  stroke="#faad14"
                  strokeWidth={2}
                  name="Warnings"
                />
                <Line
                  type="monotone"
                  dataKey="infos"
                  stroke="#1890ff"
                  strokeWidth={2}
                  name="Infos"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Validation Type Distribution (Top 10) */}
        <Col xs={24} lg={12}>
          <Card title="Top Validation Types" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.all_validations.slice(0, 10).map((v) => ({
                  name: v.type.length > 20 ? v.type.substring(0, 20) + '...' : v.type,
                  count: v.count,
                  fullName: v.type,
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={150}
                />
                <Tooltip
                  formatter={(value: any) => [value, 'Count']}
                  labelFormatter={(label: any, payload: any) =>
                    payload?.[0]?.payload?.fullName || label
                  }
                />
                <Bar dataKey="count" fill="#7C57FF" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Source Type Distribution */}
        <Col xs={24} lg={12}>
          <Card title="Source Type Distribution" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(data.source_types).map(([source, stats]) => ({
                    name: getSourceTypeLabel(source),
                    value: stats.count,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.entries(data.source_types).map((entry, index) => {
                    const colors = ['#7C57FF', '#9A7EFE', '#B39DFD'];
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors[index % colors.length]}
                      />
                    );
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Severity Distribution */}
        <Col xs={24} lg={12}>
          <Card title="Severity Distribution" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    {
                      name: 'Errors',
                      value: data.summary.total_errors,
                    },
                    {
                      name: 'Warnings',
                      value: data.summary.total_warnings,
                    },
                    {
                      name: 'Infos',
                      value: data.summary.total_infos,
                    },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) =>
                    `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#ff4d4f" />
                  <Cell fill="#faad14" />
                  <Cell fill="#1890ff" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Source Type Breakdown */}
        {Object.keys(data.source_types).length > 0 && (
          <Col xs={24} lg={12}>
            <Card title="Source Type Breakdown" style={{ height: '100%' }}>
              <Row gutter={[16, 16]}>
                {Object.entries(data.source_types).map(([source, stats]) => (
                  <Col xs={24} sm={8} key={source}>
                    <Card size="small">
                      <Statistic
                        title={getSourceTypeLabel(source)}
                        value={stats.count}
                        suffix="runs"
                      />
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        <div>Errors: {stats.total_errors}</div>
                        <div>Warnings: {stats.total_warnings}</div>
                        <div>Infos: {stats.total_infos}</div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}
      </Row>

      {/* All Validations */}
      <Card title="All Validation Types" style={{ marginBottom: '24px' }}>
        <Table
          dataSource={data.all_validations}
          columns={columns}
          rowKey={(record, index) => `${record.type}-${record.severity}-${index}`}
          pagination={false}
          size="small"
        />
      </Card>

      {/* Recent Runs */}
      <Card title="Recent Runs">
        <Table
          dataSource={data.recent_runs}
          columns={runColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default Analytics;

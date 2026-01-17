import React from 'react';
import { Select, Space, Typography, Switch } from 'antd';

const { Text } = Typography;
const { Option } = Select;

export type FilterState = {
  spreadId: string[] | null;
  pageId: string[] | null;
  validationType: ('errors' | 'warnings' | 'infos')[] | null;
  dataId: string | null;
};

type ValidationFiltersProps = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  spreadOptions: Array<{ value: string; label: string }>;
  pageOptions: Array<{ value: string; label: string }>;
  validationTypeOptions: Array<{ value: string; label: string }>;
  dataIdOptions: Array<{ value: string; label: string }>;
  highlightEnabled: boolean;
  onHighlightToggle: (enabled: boolean) => void;
};

const ValidationFilters = ({
  filters,
  onFiltersChange,
  spreadOptions,
  pageOptions,
  validationTypeOptions,
  dataIdOptions,
  highlightEnabled,
  onHighlightToggle,
}: ValidationFiltersProps) => {
  const handleSpreadChange = (value: string[] | null) => {
    onFiltersChange({ ...filters, spreadId: value && value.length > 0 ? value : null });
  };

  const handlePageChange = (value: string[] | null) => {
    onFiltersChange({ ...filters, pageId: value && value.length > 0 ? value : null });
  };

  const handleValidationTypeChange = (value: ('errors' | 'warnings' | 'infos')[] | null) => {
    onFiltersChange({ ...filters, validationType: value && value.length > 0 ? value : null });
  };

  const handleDataIdChange = (value: string | null) => {
    onFiltersChange({ ...filters, dataId: value || null });
  };

  const clearFilters = () => {
    onFiltersChange({ spreadId: null, pageId: null, validationType: null, dataId: null });
  };

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap'
    }}>
      <Text strong style={{ fontSize: '14px', marginRight: '8px' }}>Filters:</Text>
      <Space size="middle" wrap>
        <Select
          placeholder="All Spreads"
          value={filters.spreadId || undefined}
          onChange={handleSpreadChange}
          allowClear
          mode="multiple"
          maxTagCount="responsive"
          style={{ minWidth: 150 }}
        >
          {spreadOptions.map(option => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="All Pages"
          value={filters.pageId || undefined}
          onChange={handlePageChange}
          allowClear
          mode="multiple"
          maxTagCount="responsive"
          style={{ minWidth: 150 }}
        >
          {pageOptions.map(option => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="All Types"
          value={filters.validationType || undefined}
          onChange={handleValidationTypeChange}
          allowClear
          mode="multiple"
          maxTagCount="responsive"
          style={{ minWidth: 150 }}
        >
          {validationTypeOptions.map(option => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="All Data IDs"
          value={filters.dataId}
          onChange={handleDataIdChange}
          allowClear
          style={{ minWidth: 150 }}
          showSearch
          filterOption={(input, option) => {
            const label = typeof option?.label === 'string' ? option.label : String(option?.label || '');
            return label.toLowerCase().includes(input.toLowerCase());
          }}
        >
          {dataIdOptions.map(option => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
        {(filters.spreadId || filters.pageId || filters.validationType || filters.dataId) && (
          <Text
            type="secondary"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={clearFilters}
          >
            Clear Filters
          </Text>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <Text style={{ fontSize: '14px' }}>Highlight Issues:</Text>
          <Switch
            checked={highlightEnabled}
            onChange={onHighlightToggle}
            checkedChildren="On"
            unCheckedChildren="Off"
          />
        </div>
      </Space>
    </div>
  );
};

export default ValidationFilters;

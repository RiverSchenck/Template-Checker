import { IdentifierGroupedData, ClassifierData, ValidationType, TextBoxData, ValidationItem, ValidationEntries } from '../types';
import { CloseCircleOutlined, InfoCircleOutlined, WarningOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Tag, Typography, Popover, Button } from 'antd';

const { Text } = Typography;

export const renderHelpLink = (helpArticleUrl: string | null): JSX.Element | string => {
  if (!helpArticleUrl) {
    return '';
  }

  return (
    <a className="custom-link" href={helpArticleUrl} target="_blank" rel="noopener noreferrer">
      Help Center
    </a>
  );
};

export const renderMessageElement = (classiferMessage: string, context: string) => {
  return (
    <Text>
      {classiferMessage}
      {context && (
        <Popover content={context} title="Context">
          <Button type="link" icon={<QuestionCircleOutlined style={{ color: '#6C7070' }} />} />
        </Popover>
      )}
    </Text>
  );
};

export const getValidationTag = (label: string, type: ValidationType, card: boolean = false) => {
  const baseStyle = {
    fontSize: '14px',
    padding: '5px 10px',
    borderRadius: '4px',
    lineHeight: 'normal',
    display: 'flex',
    alignItems: 'center',
    maxWidth: card ? '100%' : '190px',
  };

  const style = card ? { ...baseStyle } : baseStyle;

  const getColor = (type: ValidationType) => {
    switch (type) {
      case 'errors': return 'red';
      case 'warnings': return 'orange';
      case 'infos': return 'blue';
      default: return 'gray';
    }
  };

  const getIcon = (type: ValidationType) => {
    switch (type) {
      case 'errors': return <CloseCircleOutlined style={{ color: 'red', fontSize: '20px', paddingRight: '5px', flexShrink: 0 }} />;
      case 'warnings': return <WarningOutlined style={{ color: 'orange', fontSize: '20px', paddingRight: '5px', flexShrink: 0 }} />;
      case 'infos': return <InfoCircleOutlined style={{ color: 'blue', fontSize: '20px', paddingRight: '5px', flexShrink: 0 }} />;
      default: return null;
    }
  };

  return (
    <Tag color={getColor(type)} style={style}>
      {getIcon(type)}
      <div style={{ flex: 1, textAlign: 'center', marginRight: '5px', wordBreak: 'break-word' }}>
        {label}
      </div>
    </Tag>
  );
};

export const isCategoryEmpty = (data: IdentifierGroupedData): boolean => {
  return Object.values(data).every(entries =>
    entries.errors.length === 0 &&
    entries.warnings.length === 0 &&
    entries.infos.length === 0
  );
};

export const groupItemsByClassifier = (items: ValidationItem[]): Record<string, ValidationItem[]> => {
  return items.reduce((acc, item) => {
    const { validationClassifier } = item;
    if (!acc[validationClassifier]) {
      acc[validationClassifier] = [];
    }
    acc[validationClassifier].push(item);
    return acc;
  }, {} as Record<string, ValidationItem[]>);
};

// Filter identifier data to only include items matching the selected data-id
export const filterByIdentifierDataId = (identifierData: IdentifierGroupedData, dataId: string | null): IdentifierGroupedData => {
  if (!dataId) {
    return identifierData; // Return all data if no filter
  }

  const filtered: IdentifierGroupedData = {};

  Object.entries(identifierData).forEach(([identifier, entries]) => {
    const filteredEntries = {
      errors: entries.errors.filter(item => item.data_id === dataId),
      warnings: entries.warnings.filter(item => item.data_id === dataId),
      infos: entries.infos.filter(item => item.data_id === dataId)
    };

    // Only include this identifier if it has at least one matching item
    if (filteredEntries.errors.length > 0 ||
      filteredEntries.warnings.length > 0 ||
      filteredEntries.infos.length > 0) {
      filtered[identifier] = filteredEntries;
    }
  });

  return filtered;
};

// Filter identifier data by spread, page, validation type, and data_id
export const filterByIdentifierFilters = (
  identifierData: IdentifierGroupedData,
  filters: { spreadId: string[] | null; pageId: string[] | null; validationType: ('errors' | 'warnings' | 'infos')[] | null; dataId: string | null }
): IdentifierGroupedData => {
  const { spreadId, pageId, validationType, dataId } = filters;

  // If no filters are applied, return all data
  if ((!spreadId || spreadId.length === 0) && (!pageId || pageId.length === 0) && (!validationType || validationType.length === 0) && !dataId) {
    return identifierData;
  }

  const filtered: IdentifierGroupedData = {};

  Object.entries(identifierData).forEach(([identifier, entries]) => {
    const filterEntries = (items: ValidationItem[]) => {
      return items.filter(item => {
        // Filter by spread (check if item's spread is in the selected spreads array)
        if (spreadId && spreadId.length > 0 && !spreadId.includes(item.spread_id)) {
          return false;
        }
        // Filter by page (check if item's page is in the selected pages array)
        if (pageId && pageId.length > 0 && !pageId.includes(item.page_id)) {
          return false;
        }
        // Filter by data_id
        if (dataId && item.data_id !== dataId) {
          return false;
        }
        return true;
      });
    };

    let filteredEntries: ValidationEntries;

    if (validationType && validationType.length > 0) {
      // Filter specific validation types (array)
      filteredEntries = {
        errors: validationType.includes('errors') ? filterEntries(entries.errors) : [],
        warnings: validationType.includes('warnings') ? filterEntries(entries.warnings) : [],
        infos: validationType.includes('infos') ? filterEntries(entries.infos) : []
      };
    } else {
      // Filter all types
      filteredEntries = {
        errors: filterEntries(entries.errors),
        warnings: filterEntries(entries.warnings),
        infos: filterEntries(entries.infos)
      };
    }

    // Only include this identifier if it has at least one matching item
    if (filteredEntries.errors.length > 0 ||
      filteredEntries.warnings.length > 0 ||
      filteredEntries.infos.length > 0) {
      filtered[identifier] = filteredEntries;
    }
  });

  return filtered;
};

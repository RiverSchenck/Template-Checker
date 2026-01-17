import { IdentifierGroupedData, ClassifierData, TableDataItem, ValidationType, TextBoxData, ValidationItem } from '../types';
import { CloseCircleOutlined, InfoCircleOutlined, WarningOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Tag, Typography, Popover, Button } from 'antd';

const { Text } = Typography;

export function transformDataForTable(identifierData: IdentifierGroupedData, validationClassifiers: { [key: string]: ClassifierData}, textBoxes: { [key: string]: TextBoxData }): TableDataItem[] {
    const tableData: TableDataItem[] = [];
    Object.entries(identifierData).forEach(([identifier, entries]) => {
      (['errors', 'warnings', 'infos'] as ValidationType[]).forEach(type => {
        entries[type].forEach((issue, index)=> {
          if (validationClassifiers[issue.validationClassifier]) { // Make sure the classifier exists
            const textBoxData = issue.identifier ? textBoxes[issue.identifier] : undefined;
            tableData.push({
              key: `${identifier}-${issue.validationClassifier}-${type}-${index}`,
              identifier,
              type: issue.validationClassifier,
              page: issue.page,
              page_id: issue.page_id,
              context: issue.context,
              validationType: type,
              textBox: textBoxData,
              classifier: validationClassifiers[issue.validationClassifier] // Access using dynamic keys
            });
          }
        });
      });
    });
    return tableData;
  }

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

  export const renderMessageElement = (classiferMessage: string, context: string)=> {
    return (
      <Text>
      {classiferMessage}
      {context && (
          <Popover content={context} title="Context">
              <Button type="link" icon={<QuestionCircleOutlined style={{ color: '#6C7070'}} />} />
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
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        maxWidth: '190px',
        flex: 1,
      };

      const style = card ?  { ...baseStyle, width: '185px' } : baseStyle ;

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
        case 'errors': return <CloseCircleOutlined style={{ color: 'red', fontSize: '20px',paddingRight:'5px' }} />;
        case 'warnings': return <WarningOutlined style={{ color: 'orange',fontSize: '20px', paddingRight:'5px' }} />;
        case 'infos': return <InfoCircleOutlined style={{ color: 'blue',fontSize: '20px', paddingRight:'5px' }} />;
        default: return null;
      }
    };

    return (
      <Tag color={getColor(type)} style={style}>
        {getIcon(type)}
        <div style={{ flex: 1, textAlign: 'center', marginRight: '5px' }}>
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

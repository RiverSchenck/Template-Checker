// ValidationCards.js
import React, { useRef, useEffect } from 'react';
import { Card, Typography, Divider } from 'antd';
import { IdentifierGroupedData, ValidationCategory, TextBoxData, ValidationItem, ValidationType, ClassifierData } from '../../../types';
import ValidationStyle from './ValidationStyle';
import { groupItemsByClassifier } from '../../helpers';
import { highlightElement } from '../../../utils/messageUtils';

const { Text } = Typography

type ValidationCardProps = {
  identifierData: IdentifierGroupedData;
  category: ValidationCategory;
  textBoxData: { [key: string]: TextBoxData };
  validationClassifiers: { [key: string]: ClassifierData };
  selectedDataId?: string | null;
};

const ValidationCards = ({ identifierData, category, textBoxData, validationClassifiers, selectedDataId }: ValidationCardProps) => {
  const getAllDataIds = (entries: { errors: ValidationItem[], warnings: ValidationItem[], infos: ValidationItem[] }): string[] => {
    const allItems = [...entries.errors, ...entries.warnings, ...entries.infos];
    const dataIds = allItems
      .map(item => item.data_id)
      .filter((dataId): dataId is string => Boolean(dataId));
    return [...new Set(dataIds)]; // Remove duplicates
  };

  const handleCardClick = async (entries: { errors: ValidationItem[], warnings: ValidationItem[], infos: ValidationItem[] }) => {
    const dataIds = getAllDataIds(entries);
    // Highlight the first data_id (you can modify this to highlight all if needed)
    // For now, we'll highlight the first one. You can extend this to highlight all
    if (dataIds.length > 0) {
      await highlightElement(dataIds[0]);
    }
  };

  return (
    <>
      {Object.entries(identifierData).map(([identifier, entries]) => {
        const textBoxContent = category === ValidationCategory.text_boxes ? textBoxData[identifier]?.content : null;
        const textBoxPage = category === ValidationCategory.text_boxes ? textBoxData[identifier]?.page : null;
        const dataIds = getAllDataIds(entries);
        const hasClickableDataIds = dataIds.length > 0;

        const renderValidationItems = (items: ValidationItem[], type: ValidationType) => {
          const groupedItems = groupItemsByClassifier(items);

          return Object.entries(groupedItems).map(([classifier, items], index) => (
            <ValidationStyle
              key={index}
              validationType={type}
              category={category}
              items={items}
              classifierData={validationClassifiers[classifier]}
              selectedDataId={selectedDataId}
            />
          ));
        };

        // Check if this card should be highlighted (contains selected data_id)
        const shouldHighlight = selectedDataId && dataIds.includes(selectedDataId);

        return (
          <Card
            size='small'
            style={{
              backgroundColor: shouldHighlight ? '#FFF9E6' : '#FAFAFA',
              marginTop: '10px',
              padding: '5px',
              cursor: hasClickableDataIds ? 'pointer' : 'default',
              transition: 'all 0.2s',
              border: shouldHighlight ? '2px solid #B39DFD' : undefined,
              boxShadow: shouldHighlight ? '0 4px 12px rgba(179, 157, 253, 0.4)' : undefined
            }}
            onClick={() => handleCardClick(entries)}
            onMouseEnter={(e) => {
              if (hasClickableDataIds) {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(179, 157, 253, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!shouldHighlight) {
                e.currentTarget.style.boxShadow = 'none';
              } else {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(179, 157, 253, 0.4)';
              }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {textBoxContent && (
                <Text>Text Box: <span>{textBoxContent}</span></Text>
              )}
              {textBoxPage && (
                <Text>Page: <span>{textBoxPage}</span></Text>
              )}
              {!textBoxContent && identifier !== 'null' && (
                <Text>{identifier}</Text>
              )}
              <Divider type='horizontal' style={{ marginTop: '0px', marginBottom: '5px' }} />
              {renderValidationItems(entries.errors, 'errors')}
              {renderValidationItems(entries.warnings, 'warnings')}
              {renderValidationItems(entries.infos, 'infos')}
            </div>
          </Card>
        );
      })}
    </>
  );
};
////bg={'#FAFAFA'} mt={'10px'} p={'10px'}
export default ValidationCards;

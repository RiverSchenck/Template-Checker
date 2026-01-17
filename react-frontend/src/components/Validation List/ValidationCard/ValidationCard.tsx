// ValidationCards.js
import React from 'react';
import { Card, Typography, Divider } from 'antd';
import { IdentifierGroupedData, ValidationCategory, TextBoxData, ValidationItem, ValidationType, ClassifierData } from '../../../types';
import ValidationStyle from './ValidationStyle';
import { groupItemsByClassifier } from '../../helpers';

const { Text } = Typography

type ValidationCardProps = {
    identifierData: IdentifierGroupedData;
    category: ValidationCategory;
    textBoxData: {[key: string]: TextBoxData};
    validationClassifiers: {[key: string]: ClassifierData}
};


const ValidationCards = ({ identifierData, category, textBoxData, validationClassifiers }: ValidationCardProps) => {
    return (
        <>
          {Object.entries(identifierData).map(([identifier, entries]) => {
            const textBoxContent = category === ValidationCategory.text_boxes ? textBoxData[identifier]?.content : null;
            const textBoxPage = category === ValidationCategory.text_boxes ? textBoxData[identifier]?.page_name : null;

            const renderValidationItems = (items: ValidationItem[], type: ValidationType) => {
                const groupedItems = groupItemsByClassifier(items);

                return Object.entries(groupedItems).map(([classifier, items], index) => (
                  <ValidationStyle
                    key={index}
                    validationType={type}
                    category={category}
                    items={items}
                    classifierData={validationClassifiers[classifier]}
                  />
                ));
              };

            return (
              <Card key={identifier}  size='small' style={{ backgroundColor: '#FAFAFA', marginTop: '10px', padding: '5px'}}>
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
                    <Divider type='horizontal' style={{ marginTop: '0px', marginBottom: '5px' }}/>
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

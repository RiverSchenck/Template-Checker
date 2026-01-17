import React from 'react';
import { ValidationType, ClassifierData, ValidationItem, ValidationCategory } from '../../../types';
import { List, Alert, Typography } from 'antd'
import { getValidationTag, renderHelpLink, renderMessageElement } from '../../helpers';

interface ValidationItemProps {
  validationType: ValidationType;
  category: ValidationCategory;
  items: ValidationItem[];
  classifierData?: ClassifierData;
}

const { Text } = Typography;

const ValidationStyle = ({ validationType, category, items, classifierData }: ValidationItemProps) => {
      const statusMapping: Record<string, "error" | "warning" | "info" | "success" | undefined> = {
        errors: 'error',
        warnings: 'warning',
        infos: 'info'
      };

      const alertStatus = statusMapping[validationType] || 'info';

      return (
        <Alert
            type={alertStatus}
            style={{ width: '100%' }}
            message={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: '3px' }}>
                        <Text strong>
                            {getValidationTag(classifierData?.label || '', validationType, true)}
                        </Text>
                    </div>
                    <List
                        size="small"
                        dataSource={items}
                        renderItem={item => (
                            <List.Item style={{ textAlign: 'left' }}>
                                {renderMessageElement(classifierData?.message || '', item.context || '')}
                            </List.Item>
                        )}
                    />
                    <Text style={{ whiteSpace: 'nowrap', marginLeft: 'auto', alignSelf: 'flex-start', marginTop: '8px' }}>
                        {renderHelpLink(classifierData?.help_article || null)}
                    </Text>
                </div>
            }
        />
    );


};


export default ValidationStyle;

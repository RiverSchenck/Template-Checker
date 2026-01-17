import React, { useRef, useEffect } from 'react';
import { ValidationType, ClassifierData, ValidationItem, ValidationCategory } from '../../../types';
import { List, Alert, Typography } from 'antd'
import { getValidationTag, renderHelpLink, renderMessageElement } from '../../helpers';
import { highlightElement } from '../../../utils/messageUtils';

interface ValidationItemProps {
    validationType: ValidationType;
    category: ValidationCategory;
    items: ValidationItem[];
    classifierData?: ClassifierData;
    selectedDataId?: string | null;
}

const { Text } = Typography;

// Separate component for list item to use hooks
interface ValidationListItemProps {
    item: ValidationItem;
    isSelected: boolean;
    onItemClick: (item: ValidationItem) => void;
    message: string;
    context: string;
}

const ValidationListItem = ({ item, isSelected, onItemClick, message, context }: ValidationListItemProps) => {
    return (
        <List.Item
            style={{
                textAlign: 'left',
                cursor: item.data_id ? 'pointer' : 'default',
                padding: '8px 12px',
                transition: 'background-color 0.2s',
                backgroundColor: isSelected ? 'rgba(179, 157, 253, 0.3)' : 'transparent',
                borderLeft: isSelected ? '4px solid #B39DFD' : undefined
            }}
            onClick={(e) => {
                e.stopPropagation(); // Prevent card click from firing
                onItemClick(item);
            }}
            onMouseEnter={(e) => {
                if (item.data_id && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'rgba(179, 157, 253, 0.1)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                } else {
                    e.currentTarget.style.backgroundColor = 'rgba(179, 157, 253, 0.3)';
                }
            }}
        >
            {renderMessageElement(message, context)}
        </List.Item>
    );
};

const ValidationStyle = ({ validationType, category, items, classifierData, selectedDataId }: ValidationItemProps) => {
    const statusMapping: Record<string, "error" | "warning" | "info" | "success" | undefined> = {
        errors: 'error',
        warnings: 'warning',
        infos: 'info'
    };

    const alertStatus = statusMapping[validationType] || 'info';

    const handleItemClick = async (item: ValidationItem) => {
        if (item.data_id) {
            await highlightElement(item.data_id);
        }
    };

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
                        renderItem={item => {
                            const isSelected = selectedDataId && item.data_id === selectedDataId;
                            return (
                                <ValidationListItem
                                    item={item}
                                    isSelected={!!isSelected}
                                    onItemClick={handleItemClick}
                                    message={classifierData?.message || ''}
                                    context={item.context || ''}
                                />
                            );
                        }}
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

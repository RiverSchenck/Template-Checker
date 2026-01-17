import React from 'react';
import { Table, TableColumnType } from 'antd';
import { TableDataItem, ValidationCategory, TextBoxData, IdentifierGroupedData, ClassifierData } from '../../../types';
import { transformDataForTable, renderHelpLink, getValidationTag, renderMessageElement } from '../../helpers';

type ValidationTableProps = {
  identifierData: IdentifierGroupedData;
  category: ValidationCategory;
  textBoxData: {[key: string]: TextBoxData};
  validationClassifiers: {[key: string]: ClassifierData};
};

const ValidationTable = ({ identifierData, category, textBoxData, validationClassifiers }: ValidationTableProps) => {

    const data = transformDataForTable(identifierData, validationClassifiers, textBoxData);
    // Generate filters from unique values in data
    const typeFilters = Array.from(new Set(data.map(item => item.classifier.label))).map(label => ({
        text: label,
        value: label,
      }));

    const styleFilters = Array.from(new Set(data.map(item => item.identifier))).map(identifier => ({
      text: identifier,
      value: identifier,
    }));

    const identifierColumn = (identifierLabel: string): TableColumnType<TableDataItem> => {
      return {
        title: identifierLabel,
        dataIndex: 'identifier',
        key: 'identifier',
        render: (_, record) => <span style={{ fontWeight: 500 }}>{record.identifier}</span>,
        sorter: (a: TableDataItem, b: TableDataItem) => a.identifier.localeCompare(b.identifier),
        sortDirections: ['descend', 'ascend'],
        filters: styleFilters,  // Ensure 'styleFilters' is defined in scope
        onFilter: (value, record) => typeof value === 'string' && record.identifier === value,
      };
    };

    const typeColumn = (): TableColumnType<TableDataItem> => {
      return {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (_, record) => getValidationTag(record.classifier.label, record.validationType), // Display the classifier label
        sorter: (a: TableDataItem, b: TableDataItem) => a.classifier.label.localeCompare(b.classifier.label),
        sortDirections: ['descend', 'ascend'],
        filters: typeFilters,
        onFilter: (value, record) => record.classifier.label === value,
      };
    };

    const messageColumn = (): TableColumnType<TableDataItem> => {
      return {
        title: 'Message',
        dataIndex: 'message',
        key: 'message',
        render: (_, record) => renderMessageElement(record.classifier.message, record.context),
        sorter: (a: TableDataItem, b: TableDataItem) => a.classifier.message.localeCompare(b.classifier.message),
        sortDirections: ['descend', 'ascend'],
      };
    };

    const helpArticleColumn = (): TableColumnType<TableDataItem> => {
      return {
        title: 'Help Article',
        dataIndex: 'help',
        width: 125,
        key: 'help',
        render: (text, record) => renderHelpLink(record.classifier.help_article),
      };
    };

    const pageColumn = (): TableColumnType<TableDataItem> => {
      return {
        title: 'Page',
        dataIndex: 'page_name',
        key: 'page_name',
        render: (_, record) => <strong>{record.page_name}</strong>, // Display the page name
        sorter: (a: TableDataItem, b: TableDataItem) => a.page_name.localeCompare(b.page_name),
        sortDirections: ['descend', 'ascend'],
        filters: typeFilters,
        onFilter: (value, record) => record.page_name === value,
      };
    };

    const textBoxIdentifierColumn = (): TableColumnType<TableDataItem> => {
      return {
        title: 'Text Box Content',
        dataIndex: 'identifier',
        key: 'identifier',
        render: (_, record) => <span style={{ fontWeight: 500 }}>{record.textBox?.content || ''}</span>,
        sorter: (a: TableDataItem, b: TableDataItem) => {
          const contentA = a.textBox?.content || '';
          const contentB = b.textBox?.content || '';
          return contentA.localeCompare(contentB);
        },
        sortDirections: ['descend', 'ascend'],
        filters: styleFilters,  // Ensure 'styleFilters' is defined in scope
        onFilter: (value, record) => typeof value === 'string' && record.textBox?.content === value,
      };
    };

  const getColumnSet = () => {
    switch (category) {
      case ValidationCategory.text_boxes:
        return [textBoxIdentifierColumn(), pageColumn(), typeColumn(), messageColumn(), helpArticleColumn()];
      case ValidationCategory.fonts:
        return [identifierColumn('Font Name'), typeColumn(), messageColumn(), helpArticleColumn()];
      case ValidationCategory.images:
        return [identifierColumn('Image Name'), typeColumn(), messageColumn(), helpArticleColumn()];
      case ValidationCategory.par_styles:
      case ValidationCategory.char_styles:
        return [identifierColumn('Styles'), typeColumn(), messageColumn(), helpArticleColumn()];
      case ValidationCategory.general:
        return [typeColumn(), messageColumn(), helpArticleColumn()];
      default:
        return [typeColumn(), messageColumn(), helpArticleColumn()];
    }
  };



    return (
      <Table
        columns={getColumnSet()}
        dataSource={data}
        pagination={false}
        rowKey="key"
        style={{ width: '100%', margin: '0 auto', marginBottom: '20px' }}
      />
    );
};

export default ValidationTable;

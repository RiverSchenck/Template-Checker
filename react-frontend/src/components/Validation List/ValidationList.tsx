import React,{ useState} from 'react';
import { Collapse } from 'antd';
import ValidationStats from '../Stat Group/StatGroup';
import { ValidationResult, ValidationCategory, CategoryDetail } from '../../types';
import ValidationTable from './ValidationTable/ValidationTable';
import ValidationCards from './ValidationCard/ValidationCard';
import ViewButtons from './ViewButtons';
import { isCategoryEmpty } from '../helpers';


type ValidationListProps = {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  seeDetails?: Boolean;
};


function ValidationList({ jsonResponse, previousJsonResponse, checkerResponse, seeDetails}: ValidationListProps) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');

  const { validation_classifiers } = jsonResponse;

  const defaultKeys: (keyof ValidationResult)[] = [
    'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general'
  ];

  const renderCategoryData = () => {
    return defaultKeys.map((key) => {
      const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;

      if (!categoryData) return null; // Ensure categoryData is defined

      const isEmpty = isCategoryEmpty(categoryData.details);
      if (isEmpty) return null; // Skip rendering if the category is empty

      return (
        <Collapse.Panel
          header={
              <span>{categoryEnum}</span>
          }
          key={key}
        >
         <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ width: '95%' }}>
            {viewMode === 'card' ? (
              <ValidationCards
                identifierData={categoryData.details}
                category={categoryEnum}
                textBoxData={jsonResponse.text_box_data}
                validationClassifiers={validation_classifiers}
              />
            ) : (
              <ValidationTable
                identifierData={categoryData.details}
                category={categoryEnum}
                textBoxData={jsonResponse.text_box_data}
                validationClassifiers={validation_classifiers}
              />
            )}
          </div>
        </div>
        </Collapse.Panel>
      );
    });
  };

  return (
    <div style={{width: '100%', height: '100%'}} >
      <div style={{backgroundColor: "#EAEBEB"}}>
        <ValidationStats jsonResponse={jsonResponse} checkerResponse={checkerResponse} previousJsonResponse={previousJsonResponse} seeDetails={seeDetails}/>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', marginBottom: '-40px', marginRight: '4%' }}>
        <div style={{marginRight:'10px', zIndex: '999'}}>
            {/* <CopyAll jsonResponse={jsonResponse}/> */}
          </div>
          <ViewButtons viewMode={viewMode} setViewMode={setViewMode} />
      </div>
        <Collapse defaultActiveKey={defaultKeys} size='large' bordered={false} style={{ backgroundColor: 'transparent', border: 'none', }}>
          {renderCategoryData()}
        </Collapse>
      </div>
    </div>
  );
};



export default ValidationList;

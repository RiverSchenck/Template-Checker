import { Page, Text, View, Document, StyleSheet, Link, Svg, Path, Note } from '@react-pdf/renderer';
import { ValidationResult, IdentifierGroupedData, ValidationCategory, CategoryDetail, TextBoxData, ClassifierData, ValidationItem, ValidationType } from '../types';
import { groupItemsByClassifier, isCategoryEmpty } from '../components/helpers';
import { Font } from '@react-pdf/renderer';


type CreatePDFProps = {
  jsonResponse: ValidationResult;
}

const CreatePDF = ({jsonResponse}: CreatePDFProps) => {
  const defaultKeys = [
    'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general'
  ];

  const getValidationTag = (label: string, type: ValidationType ) => {

      const ErrorIcon = () => (
        <Svg height="16" width="16" viewBox="0 0 1024 1024">
          <Path d="M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64Zm0 76c-205.4 0-372 166.6-372 372s166.6 372 372 372 372-166.6 372-372-166.6-372-372-372Zm128.013 198.826c.023.007.042.018.083.059l45.02 45.019c.04.04.05.06.058.083a.118.118 0 0 1 0 .07c-.007.022-.018.041-.059.082L557.254 512l127.861 127.862a.268.268 0 0 1 .05.06l.009.023a.118.118 0 0 1 0 .07c-.007.022-.018.041-.059.082l-45.019 45.02c-.04.04-.06.05-.083.058a.118.118 0 0 1-.07 0c-.022-.007-.041-.018-.082-.059L512 557.254 384.14 685.115c-.042.041-.06.052-.084.059a.118.118 0 0 1-.07 0c-.022-.007-.041-.018-.082-.059l-45.02-45.019c-.04-.04-.05-.06-.058-.083a.118.118 0 0 1 0-.07c.007-.022.018-.041.059-.082L466.745 512l-127.86-127.86a.268.268 0 0 1-.05-.061l-.009-.023a.118.118 0 0 1 0-.07c.007-.022.018-.041.059-.082l45.019-45.02c.04-.04.06-.05.083-.058a.118.118 0 0 1 .07 0c.022.007.041.018.082.059L512 466.745l127.862-127.86c.04-.041.06-.052.083-.059a.118.118 0 0 1 .07 0Z" fill="red" />
        </Svg>
      );
      
      const WarningIcon = () => (
            <Svg width="16" height="16" viewBox="0 0 1024 1024">
              <Path
                d="M464 720a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm16-304v184c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V416c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8zm475.7 440l-416-720c-6.2-10.7-16.9-16-27.7-16s-21.6 5.3-27.7 16l-416 720C56 877.4 71.4 904 96 904h832c24.6 0 40-26.6 27.7-48zm-783.5-27.9L512 239.9l339.8 588.2H172.2z"
                stroke="orange"
              />
            </Svg>
      );
      
      const InfoIcon = () => (
        <Svg height="16" width="16" viewBox="0 0 1024 1024">
          <Path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" fill="blue" />
          <Path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" fill="blue" />
        </Svg>
      );
  
    const getColor = (type: ValidationType) => {
      switch (type) {
        case 'errors': return 'red';
        case 'warnings': return 'orange';
        case 'infos': return 'blue';
        default: return 'gray';
      }
    };
  
    const getIcon = (type: ValidationType) => {
      console.log("ICON: ", type)
      switch (type) {
        case 'errors': return <ErrorIcon />;
        case 'warnings': return <WarningIcon />;
        case 'infos': return <InfoIcon />;
        default: return null;
      }
    };

    const color = getColor(type);
    
  
    return (
      <View style={styles.issueLabel}>
        {getIcon(type)}
        <View style={{ textAlign: 'center', marginLeft: '5px' }}>
          <Text style={{...styles.text, color: color, fontSize: 11, fontWeight: 'bold'}}>{label}</Text>
        </View>
      </View>
    );
  };

  const renderMessageElement = (classifierMessage: string, context: string) => {
    return (
      <Text>
        {classifierMessage}
          <Note style={{ fontSize: 10, color: '#666' }}>
            HELOOO THIS IS TEXT
          </Note>
      </Text>
    );
  };

  const renderHelpLink = (helpArticleUrl: string | null): JSX.Element | null => {
    if (!helpArticleUrl) {
      return null;
    }
  
    return (
      <Text style={styles.text}>
        <Link src={helpArticleUrl} style={styles.link}>
          Help Center
        </Link>
      </Text>
    );
  };

  interface ValidationStyleProps {
    validationType: ValidationType;
    category: ValidationCategory;
    items: ValidationItem[];
    classifierData?: ClassifierData;
  }

  const ValidationStyle = ({ validationType, category, items, classifierData }: ValidationStyleProps) => {
    const alertBackgroundColorMapping = {
      errors: '#fff2f0',
      warnings: '#fffbe6',
      infos: '#e6f4ff',
    };

    const alertBorderColorMapping = {
      errors: { color: '#ffccc7', width: 1, style: 'solid' },
      warnings: { color: '#ffe58f', width: 1, style: 'solid' },
      infos: { color: '#91caff', width: 1, style: 'solid' },
    };

    const backgroundColor = alertBackgroundColorMapping[validationType];
    const borderStyle = alertBorderColorMapping[validationType];

    const dynamicStyle = {
      ...styles.issueContainer,
      backgroundColor: backgroundColor,
      borderColor: borderStyle.color,
      borderWidth: borderStyle.width,
    };

    return (
      <View wrap={false} style={dynamicStyle}>
      <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <View style={{...dynamicStyle, width: '185px', alignItems: 'center', padding: 3}}>
          {getValidationTag(classifierData?.label || '', validationType)}
        </View>
          {items.map((item, index) => (
            <Text key={index} style={{...styles.textSmall, textAlign: 'left'}}>
              {renderMessageElement(classifierData?.message || '', item.context || '')}
            </Text>
          ))}
        </View>
        <Text style={{ marginLeft: 'auto', fontSize: 12 }}>
          {renderHelpLink(classifierData?.help_article || null)}
        </Text>
      </View>
    </View>
  );
};

type ValidationCardProps = {
  identifierData: IdentifierGroupedData;
  category: ValidationCategory;
  textBoxData: {[key: string]: TextBoxData};
  validationClassifiers: {[key: string]: ClassifierData}
};

  const renderCard = ({ identifierData, category, textBoxData, validationClassifiers }: ValidationCardProps) => {
    return (
      <>
        {Object.entries(identifierData).map(([identifier, entries]) => {
          const textBoxContent = category === ValidationCategory.text_boxes ? textBoxData[identifier]?.content : null;
          const textBoxPage = category === ValidationCategory.text_boxes ? textBoxData[identifier]?.page : null;
  
          const renderValidationItems = (items: ValidationItem[], type: ValidationType) => {
              const groupedItems = groupItemsByClassifier(items);
              
              return Object.entries(groupedItems).map(([classifier, items], index) => (
                <ValidationStyle 
                  validationType={type} 
                  category={category}
                  items={items} 
                  classifierData={validationClassifiers[classifier]}
                />
              ));
            };
          
          return (
            <View wrap={false} style={styles.card}>
                {textBoxContent && (
                  <Text style={styles.text}>Text Box Content: {textBoxContent}</Text>
                )}
                {textBoxPage && (
                  <Text style={styles.text}>Page: {textBoxPage}</Text>
                )}
                {!textBoxContent && identifier !== 'null' && (
                  <Text style={styles.text}>{identifier}</Text>
                )}
                <View style={styles.divider} />
                {renderValidationItems(entries.errors, 'errors')}
                {renderValidationItems(entries.warnings, 'warnings')}
                {renderValidationItems(entries.infos, 'infos')}
            </View>
          );
        })}
      </>
    );
  }

  const renderCategoryData = () => {
    return defaultKeys.map((key) => {
      const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
      
      if (!categoryData) return null; // Ensure categoryData is defined

      const isEmpty = isCategoryEmpty(categoryData.details);
      if (isEmpty) return null; // Skip rendering if the category is empty

      return (
        <Page style={{backgroundColor: '#EAEBEB'}}>
          <Text style={styles.header}>{categoryEnum} Issues: </Text>
          <View style={styles.page}>
            <View style={styles.cardContainer}>
              {renderCard({
                identifierData: categoryData.details,
                category: categoryEnum,
                textBoxData: jsonResponse.text_box_data,
                validationClassifiers: jsonResponse.validation_classifiers
              })}
            </View>
          </View>
        </Page>
      );
    });
  };

  return (
    <Document>
      {renderCategoryData()}
    </Document>
  );
};

export default CreatePDF;

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column', 
    alignItems: 'center', 
    width: '100%',
    padding: 10,
  },
  cardContainer: {
    display: 'flex',
    justifyContent: 'center',  // Centers content horizontally
    width: '95%',  // Gives some margin from the page edges
  },
  header: {
    padding: '12px 16px',
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #d9d9d9',
    marginBottom: 5, // Extra space after the header
  },
  container: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    padding: 5,
    flexDirection: 'column',
    gap: 8,
    borderRadius: 4,
  },
  divider: {
    marginTop: 0,
    marginBottom: 5,
    borderTopWidth: .5,
    borderTopColor: '#E2E2E2',
    borderTopStyle: 'solid',
  },
  text: {
    fontSize: 12,
  },
  textSmall: {
    fontSize: 10,
  },
  link: {
    color: '#9a7efe',
    textDecoration: 'underline',
    fontSize: 10,
  },
  issueContainer: {
    width: '100%', 
    padding: 10, 
    marginBottom: 10,  
    borderRadius: 6, 
  },
  issueLabel: {
    fontSize: 14,
    borderRadius: 2,
    flexDirection: 'row', 
    alignItems: 'center',
  },
});

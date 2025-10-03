import { ValidationCategory, ValidationType, CategoryDetail, ValidationResult } from '../../types';

const defaultKeys = [
  'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general'
];

const emojis = {
  errors: '❌',
  warnings: '⚠️',
  infos: 'ℹ️'
};

export const buildReport = (data: ValidationResult, specificKey?: keyof ValidationResult) => {
  const { validation_classifiers, text_box_data } = data;
  let report = `Validation Report for ${data.template_name}\n`;
  report += '❌Error - will cause issues.\n⚠️Warning - may cause issues.\nℹ️Info - informative.\n\n';
  
  const keys = specificKey ? [specificKey] : defaultKeys;

  keys.forEach(key => {
    const category = data[key as keyof ValidationResult] as CategoryDetail;
    if (Object.keys(category.details).length > 0) {  // Check if the details object has entries
      report += `*${ValidationCategory[key as keyof typeof ValidationCategory]} Issues*\n`;
      Object.entries(category.details).forEach(([identifier, entries]) => {
        let detailsIndented = '   ';
        if(key === 'par_styles' || key === 'char_styles'){
          report += `${detailsIndented}Style: ${identifier}\n`;
        }
        if (key === 'text_boxes' && text_box_data[identifier]) {
          report += `${detailsIndented}Text Box Content: ${text_box_data[identifier].content || 'No content provided'}`;
          report += `${detailsIndented}Page: ${text_box_data[identifier].page || 'No page number'}\n`;
        }
        if(key === 'images'){
          report += `${detailsIndented}Image: ${identifier}\n`;
        }
        if(key === 'fonts'){
          report += `${detailsIndented}Font: ${identifier}\n`;
        }
        ['errors', 'warnings', 'infos'].forEach(type => {
          const validationType = type as ValidationType;
          if (entries[validationType].length > 0) {
            entries[validationType].forEach(item => {
              // Check if context is not empty and include it conditionally
              const contextInfo = item.context ? `, Context: ${item.context}` : '';
              report += `${detailsIndented}    - Issue: ${emojis[type as ValidationType]} ${validation_classifiers[item.validationClassifier]?.label  || 'Unknown'}: ${validation_classifiers[item.validationClassifier]?.message} ${contextInfo}\n`;
            });
          }
        });
        report += '\n'
      });
    }
  });
  report += 'Learn more about these issues at our help center: "https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates"\n';
  return report;
};

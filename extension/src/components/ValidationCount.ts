import { ValidationResult, CategoryDetail } from '../types';

interface ValidationCounts {
    totalErrors: number;
    totalWarnings: number;
    totalInfos: number;
}

function countValidationIssues(validationData: ValidationResult): ValidationCounts {
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfos = 0;

    // Helper function to sum items in each identifier group
    const sumItems = (categoryDetail: CategoryDetail) => {
        for (let entries of Object.values(categoryDetail.details)) {
            totalErrors += entries.errors.length;
            totalWarnings += entries.warnings.length;
            totalInfos += entries.infos.length;
        }
    };

    // Summing errors and warnings from each category
    if (validationData.par_styles) {
        sumItems(validationData.par_styles);
    }
    if (validationData.char_styles) {
        sumItems(validationData.char_styles);
    }
    if (validationData.text_boxes) {
        sumItems(validationData.text_boxes);
    }
    if (validationData.fonts) {
        sumItems(validationData.fonts);
    }
    if (validationData.images) {
        sumItems(validationData.images);
    }
    if (validationData.general) {
        sumItems(validationData.general);
    }

    return { totalErrors, totalWarnings, totalInfos };
}

export default countValidationIssues

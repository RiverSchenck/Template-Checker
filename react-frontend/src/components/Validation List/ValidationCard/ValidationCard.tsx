import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../ui/card';
import { Separator } from '../../ui/separator';
import {
  IdentifierGroupedData,
  ValidationCategory,
  TextBoxData,
  ValidationItem,
  ValidationType,
  ClassifierData,
} from '../../../types';
import ValidationStyle from './ValidationStyle';
import { groupItemsByClassifier } from '../../helpers';

type ValidationCardProps = {
  identifierData: IdentifierGroupedData;
  category: ValidationCategory;
  textBoxData: { [key: string]: TextBoxData };
  validationClassifiers: { [key: string]: ClassifierData };
};

function truncateText(text: string | null | undefined, maxLength: number): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
}

const ValidationCards = ({
  identifierData,
  category,
  textBoxData,
  validationClassifiers,
}: ValidationCardProps) => {
  return (
    <>
      {Object.entries(identifierData).map(([identifier, entries]) => {
        let storyId = identifier;
        if (category === ValidationCategory.text_boxes && identifier.includes('_par_')) {
          storyId = identifier.split('_par_')[0];
        }
        const textBoxContent =
          category === ValidationCategory.text_boxes ? textBoxData[storyId]?.content : null;
        const textBoxPage =
          category === ValidationCategory.text_boxes ? textBoxData[storyId]?.page_name : null;

        const cardTitle =
          category === ValidationCategory.text_boxes
            ? truncateText(textBoxContent, 500) || '[Frame is empty]'
            : identifier !== 'null'
              ? identifier
              : undefined;

        const renderValidationItems = (items: ValidationItem[], type: ValidationType) => {
          const groupedItems = groupItemsByClassifier(items);
          return Object.entries(groupedItems).map(([classifier, items], index) => (
            <ValidationStyle
              key={`${classifier}-${index}`}
              validationType={type}
              category={category}
              items={items}
              classifierData={validationClassifiers[classifier]}
            />
          ));
        };

        return (
          <Card
            key={identifier}
            className="mt-3 overflow-hidden rounded-xl border border-border/40 bg-card shadow-none"
          >
            {cardTitle != null && (
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-[15px] font-medium leading-snug text-foreground">
                  {cardTitle}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="flex flex-col gap-2.5 pb-4 pt-0">
              {textBoxPage && (
                <p className="text-sm text-muted-foreground">
                  Page: <span className="text-foreground">{textBoxPage}</span>
                </p>
              )}
              {(cardTitle != null || textBoxPage) && (
                <Separator className="my-0.5" />
              )}
              {renderValidationItems(entries.errors, 'errors')}
              {renderValidationItems(entries.warnings, 'warnings')}
              {renderValidationItems(entries.infos, 'infos')}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
};

export default ValidationCards;

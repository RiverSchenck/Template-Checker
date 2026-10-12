import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '../ui/tooltip';
import type { ValidationResult } from '../../types';
import ReportView from './ReportView';
// A real /run result (Flyer-Sales_Bad test package), including the summary and check guides the backend adds.
import flyer from './__fixtures__/flyer-sales-results.json';

const result = flyer as unknown as ValidationResult;

const renderReport = (r: ValidationResult) =>
  render(
    <TooltipProvider>
      <ReportView result={r} />
    </TooltipProvider>
  );

describe('ReportView customer summary', () => {
  it('shows the summary the backend wrote, formatted like the copy', () => {
    renderReport(result);
    fireEvent.click(screen.getByRole('button', { name: /copy customer summary/i }));

    const summary = screen.getByRole('article', { name: 'Customer summary' });
    const firstTitle = result.customer_summary!.sections.find((s) => s.problem_id)!.lines[0].text;
    expect(within(summary).getByText(firstTitle)).toHaveClass('font-semibold');
    expect(summary.textContent).toContain('Likely causing the problems');
    const link = within(summary).getAllByRole('link', { name: 'Learn more' })[0];
    expect(link.getAttribute('href')).toMatch(/^https?:\/\/help\.frontify\.com\//);
  });

  it('uses the backend’s plain-language titles in the issue list', () => {
    renderReport(result);
    expect(screen.getAllByText('Text frame has no paragraph style').length).toBeGreaterThan(0);
  });

  it('turns the copy button off for results without a summary', () => {
    renderReport({ ...result, customer_summary: undefined });
    expect(screen.getByRole('button', { name: /copy customer summary/i })).toBeDisabled();
  });
});

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '../ui/tooltip';
import type { CheckResult } from '../../types';
import ReportView from './ReportView';
// A real /v1/checks response (Flyer-Sales_Bad test package), built from the backend's goldens (npm run fixtures).
import flyer from '../../fixtures/flyer-sales.json';

const result = flyer as unknown as CheckResult;

const renderReport = (r: CheckResult) =>
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
    expect(summary.textContent).toContain('Likely causes');
    const link = within(summary).getAllByRole('link', { name: 'Learn more' })[0];
    expect(link.getAttribute('href')).toMatch(/^https?:\/\/help\.frontify\.com\//);
  });

  it('uses the backend’s plain-language titles in the issue list', () => {
    renderReport(result);
    expect(screen.getAllByText('Text without a paragraph style').length).toBeGreaterThan(0);
  });

  it('turns the copy button off for results without a summary', () => {
    renderReport({ ...result, customer_summary: null });
    expect(screen.getByRole('button', { name: /copy customer summary/i })).toBeDisabled();
  });
});

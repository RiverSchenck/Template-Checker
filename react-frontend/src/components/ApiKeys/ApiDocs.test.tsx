import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ApiDocs } from './ApiDocs';
import { ENDPOINTS, ERRORS, requestExample } from './apiReference';
import { highlight } from './highlight';

describe('ApiDocs', () => {
  beforeEach(() => localStorage.clear());

  it('documents every endpoint and every error code', () => {
    render(<ApiDocs baseURL="https://api.example" onCreateKey={() => {}} />);
    ENDPOINTS.forEach((e) => expect(document.getElementById(`endpoint-${e.id}`)).toBeInTheDocument());
    ERRORS.forEach((e) => expect(document.getElementById(`error-${e.code}`)).toBeInTheDocument());
  });

  it('links every endpoint error to a documented code', () => {
    const codes = new Set(ERRORS.map((e) => e.code));
    ENDPOINTS.forEach((e) => e.errors.forEach((code) => expect(codes).toContain(code)));
  });

  it('switches every example to the chosen language and remembers it', () => {
    render(<ApiDocs baseURL="https://api.example" onCreateKey={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Python' })[0]);

    const python = Array.from(document.querySelectorAll('pre code')).filter((c) => c.textContent?.includes('import requests'));
    expect(python).toHaveLength(1 + ENDPOINTS.length); // quickstart + one per endpoint
    expect(localStorage.getItem('apiDocs.language')).toBe('python');
  });

  it('builds runnable requests against the given base URL', () => {
    const [summary, , xml] = ENDPOINTS;
    expect(requestExample(summary, 'curl', 'https://api.example')).toContain(
      'curl -X POST https://api.example/summary'
    );
    expect(requestExample(xml, 'curl', 'https://api.example')).toContain('-o Brochure-xml.zip');
    expect(requestExample(summary, 'javascript', 'https://api.example')).toContain(
      "fetch('https://api.example/summary'"
    );
  });

  it('offers to create a key', () => {
    const spy = vi.fn();
    render(<ApiDocs baseURL="https://api.example" onCreateKey={spy} />);
    fireEvent.click(screen.getByRole('button', { name: /create a key/i }));
    expect(spy).toHaveBeenCalled();
  });
});

describe('highlight', () => {
  const spans = (code: string, language: Parameters<typeof highlight>[1]) => {
    const { container } = render(<pre>{highlight(code, language)}</pre>);
    return Array.from(container.querySelectorAll('span')).map((s) => [s.textContent, s.className]);
  };

  it('keeps the text exactly, only wrapping tokens', () => {
    const code = requestExample(ENDPOINTS[0], 'python', 'https://api.example');
    const { container } = render(<pre>{highlight(code, 'python')}</pre>);
    expect(container.textContent).toBe(code);
  });

  it('colors strings, keywords and flags', () => {
    expect(spans('const x = "a";', 'javascript')).toEqual(
      expect.arrayContaining([
        ['const', 'text-sky-300'],
        ['"a"', 'text-orange-200'],
      ])
    );
    expect(spans('curl -X POST https://x \\\n  -F "file=@a.zip"', 'curl')).toEqual(
      expect.arrayContaining([
        ['curl', 'text-pink-300'],
        ['-X', 'text-emerald-300'],
        ['"file=@a.zip"', 'text-orange-200'],
      ])
    );
    expect(spans('{"a": 1}', 'json')).toEqual(
      expect.arrayContaining([
        ['"a"', 'text-sky-300'],
        ['1', 'text-violet-300'],
      ])
    );
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ALTERNATIVE_CLASS_OPTIONS,
  describeAlternativeClass,
  formatAlternativeClass,
  toAlternativeClassPayload,
  countRestrictedLines,
  toAlternativeClassValue,
} from '../utils/alternativeClass';
import AlternativeClassSelect from '../components/common/AlternativeClassSelect';
import AlternativeClassBadge from '../components/common/AlternativeClassBadge';

// §V59: nullable A/B/C. The client owns the labels and the substitution
// wording; the payload it sends back must be null, never an empty string,
// or an emptied control would fail the server's domain check.

describe('alternative-class options (§V59)', () => {
  it('offers Unrated plus A, B and C with their substitution rules', () => {
    expect(ALTERNATIVE_CLASS_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ['', 'Unrated'],
      ['A', 'Class A'],
      ['B', 'Class B'],
      ['C', 'Class C'],
    ]);
    expect(describeAlternativeClass('A')).toBe('Substitute only with direct approval.');
    expect(describeAlternativeClass('B')).toBe('Substitute per drawing notes.');
    expect(describeAlternativeClass('C')).toBe('Substitute by component value.');
  });

  it('describes an unrated part as operationally Class A', () => {
    expect(describeAlternativeClass(null)).toMatch(/Treated as Class A/);
  });
});

describe('formatAlternativeClass (§V59)', () => {
  it('labels the rated classes', () => {
    expect(formatAlternativeClass('A')).toBe('Class A');
    expect(formatAlternativeClass('c')).toBe('Class C');
  });

  it('falls back to Unrated for null, blank and unknown values', () => {
    expect(formatAlternativeClass(null)).toBe('Unrated');
    expect(formatAlternativeClass(undefined)).toBe('Unrated');
    expect(formatAlternativeClass('')).toBe('Unrated');
    expect(formatAlternativeClass('D')).toBe('Unrated');
    expect(formatAlternativeClass(3)).toBe('Unrated');
  });
});

describe('alternative-class payload mapping (§V59)', () => {
  it('sends null rather than an empty string when the class is cleared', () => {
    expect(toAlternativeClassPayload('')).toBeNull();
    expect(toAlternativeClassPayload(null)).toBeNull();
    expect(toAlternativeClassPayload('D')).toBeNull();
  });

  it('sends the canonical uppercase letter for a rated class', () => {
    expect(toAlternativeClassPayload('a')).toBe('A');
    expect(toAlternativeClassPayload(' B ')).toBe('B');
  });

  it('maps a stored class onto a form value a select can hold', () => {
    expect(toAlternativeClassValue(null)).toBe('');
    expect(toAlternativeClassValue('C')).toBe('C');
  });
});

describe('countRestrictedLines (§V48/§V59)', () => {
  const line = (resolved) => ({ resolved_alt_class: resolved });

  it('counts Class A and Unrated lines, which need approval to substitute', () => {
    expect(countRestrictedLines([line('A'), line(null), line('B'), line('C')])).toBe(2);
  });

  it('counts nothing when every line is freely substitutable', () => {
    expect(countRestrictedLines([line('B'), line('C')])).toBe(0);
  });

  it('treats an unrecognised stored class as restricted, not as substitutable', () => {
    expect(countRestrictedLines([line('D')])).toBe(1);
  });

  it('handles an absent component list', () => {
    expect(countRestrictedLines()).toBe(0);
    expect(countRestrictedLines([])).toBe(0);
  });
});

describe('AlternativeClassSelect (§V59)', () => {
  it('is reachable by its accessible label and shows the stored class', () => {
    render(<AlternativeClassSelect value="B" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Alternative Class')).toHaveValue('B');
  });

  it('reports null when the operator picks Unrated', () => {
    const onChange = vi.fn();
    render(<AlternativeClassSelect value="B" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports the letter when the operator picks a rated class', () => {
    const onChange = vi.fn();
    render(<AlternativeClassSelect value={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: 'A' } });

    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('renames only the null choice when the caller supplies an unrated label', () => {
    render(
      <AlternativeClassSelect
        value={null}
        onChange={vi.fn()}
        label="Class Override"
        unratedLabel="Use library default"
      />,
    );

    expect(screen.getByRole('option', { name: 'Use library default' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Class A' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Unrated' })).not.toBeInTheDocument();
  });

  it('shows an unrecognised stored value as Unrated rather than blanking out', () => {
    render(<AlternativeClassSelect value="D" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Alternative Class')).toHaveValue('');
  });
});

describe('AlternativeClassBadge (§V59)', () => {
  it('renders the resolved label with its substitution rule as the tooltip', () => {
    render(<AlternativeClassBadge value="A" />);

    const badge = screen.getByText('Class A');
    expect(badge).toHaveAttribute('title', 'Substitute only with direct approval.');
  });

  it('shows Unrated for an unrated line', () => {
    render(<AlternativeClassBadge value={null} />);

    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });

  it('marks a class that came from a project override', () => {
    render(<AlternativeClassBadge value="C" overridden />);

    expect(screen.getByText('(override)')).toBeInTheDocument();
    expect(screen.getByTitle('Substitute by component value. (project override)')).toBeInTheDocument();
  });
});

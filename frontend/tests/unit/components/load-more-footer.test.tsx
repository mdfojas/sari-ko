import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoadMoreFooter } from '@/components/load-more-footer';

function renderFooter(props: Partial<React.ComponentProps<typeof LoadMoreFooter>> = {}) {
  const handlers = { onPageSizeChange: vi.fn(), onLoadMore: vi.fn() };
  render(<LoadMoreFooter shown={20} total={45} pageSize={20} pageSizeOptions={[20, 50, 100]} {...handlers} {...props} />);
  return handlers;
}

describe('LoadMoreFooter', () => {
  test('says how many are shown out of the total', () => {
    renderFooter();
    expect(screen.getByText('Showing 20 of 45')).toBeInTheDocument();
  });

  test('offers "Load N more" with N capped at what is left, and calls back', () => {
    const { onLoadMore } = renderFooter({ shown: 40, total: 45 });
    fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  test('has no Load button once everything is shown', () => {
    renderFooter({ shown: 45, total: 45 });
    expect(screen.queryByRole('button', { name: /load/i })).not.toBeInTheDocument();
  });

  test('lists the page-size options and reports a change as a number', () => {
    const { onPageSizeChange } = renderFooter();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['20', '50', '100']);
    fireEvent.change(screen.getByLabelText(/results per load/i), { target: { value: '50' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});

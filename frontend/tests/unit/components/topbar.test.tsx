import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import { TopbarSlot } from '@/components/topbar-slot';

describe('Topbar / TopbarSlot', () => {
  test('renders whatever the current route registers via TopbarSlot', () => {
    render(
      <TopbarProvider>
        <Topbar />
        <TopbarSlot>
          <h1>Products</h1>
        </TopbarSlot>
      </TopbarProvider>
    );

    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();
  });

  test('clears its content when the registering component unmounts', () => {
    function Harness() {
      const [showSlot, setShowSlot] = useState(true);
      return (
        <TopbarProvider>
          <Topbar />
          {showSlot && (
            <TopbarSlot>
              <h1>Products</h1>
            </TopbarSlot>
          )}
          <button onClick={() => setShowSlot(false)}>hide</button>
        </TopbarProvider>
      );
    }
    render(<Harness />);

    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'hide' }));

    expect(screen.queryByRole('heading', { name: 'Products' })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getDestinationPreview, setDestinationPreview, useDestinationPreview } from '../../src/utils/destinationPreview';

// fb:6416f76e (extra) — pointing at a destination in the panel lights the board
// tile. The panel and board share only this store.
describe('destinationPreview store', () => {
  afterEach(() => setDestinationPreview(null));

  it('notifies a subscribed component when the pointed-at destination changes', () => {
    const { result } = renderHook(() => useDestinationPreview());
    expect(result.current).toBeNull();
    act(() => setDestinationPreview('ARCH-INITIATION'));
    expect(result.current).toBe('ARCH-INITIATION');
    act(() => setDestinationPreview(null));
    expect(result.current).toBeNull();
  });

  it('holds the latest value', () => {
    setDestinationPreview('LEND-SCOPE-CHECK');
    expect(getDestinationPreview()).toBe('LEND-SCOPE-CHECK');
  });
});

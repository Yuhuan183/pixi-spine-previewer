import { useEffect, useState } from 'react';

/**
 * Desktop-first breakpoints. `compact` is still a desktop window — a half-screen split or a
 * 13" laptop with both rails open — so the rails turn into overlays there instead of
 * disappearing, which is what a phone layout would do.
 */
export type Layout = 'wide' | 'medium' | 'compact';

const MEDIUM_QUERY = '(max-width: 1439px)';
const COMPACT_QUERY = '(max-width: 1099px)';
const SHORT_QUERY = '(max-height: 719px)';

export function useLayout(): { layout: Layout; short: boolean } {
  const [state, setState] = useState(() => read());

  useEffect(() => {
    const queries = [MEDIUM_QUERY, COMPACT_QUERY, SHORT_QUERY].map((query) => window.matchMedia(query));
    const update = () => setState(read());

    for (const query of queries) query.addEventListener('change', update);

    return () => {
      for (const query of queries) query.removeEventListener('change', update);
    };
  }, []);

  return state;
}

function read(): { layout: Layout; short: boolean } {
  const compact = window.matchMedia(COMPACT_QUERY).matches;
  const medium = window.matchMedia(MEDIUM_QUERY).matches;

  return {
    layout: compact ? 'compact' : medium ? 'medium' : 'wide',
    short: window.matchMedia(SHORT_QUERY).matches,
  };
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, canAccessRoute } from '../lib/auth';
import { PILOT_FLAGS } from '../lib/flags';

export function useKeyboardShortcuts({
  onOpenPalette,
  onOpenShortcuts,
}: {
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimer: number | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isInput =
        target?.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        gPressed = true;
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          gPressed = false;
        }, 1200);
        return;
      }

      if (gPressed) {
        const user = getSession();
        const key = e.key.toLowerCase();
        gPressed = false;
        if (gTimer) window.clearTimeout(gTimer);
        if (key === 'c' && canAccessRoute(user, 'cases')) {
          e.preventDefault();
          navigate('/assessments');
        } else if (key === 'o' && canAccessRoute(user, 'overview')) {
          e.preventDefault();
          navigate('/');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [navigate, onOpenPalette, onOpenShortcuts]);
}

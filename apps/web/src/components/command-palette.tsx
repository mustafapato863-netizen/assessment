import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  ClipboardCheck,
  CornerDownLeft,
  Keyboard,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { PILOT_FLAGS } from '../lib/flags';
import { copy, statusLabels, statusTone } from '../lib/labels';

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: string;
  category: 'Navigation' | 'Recent cases';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onSelect: () => void;
  shortcut?: string;
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const { data: cases } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const navItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      {
        id: 'nav-overview',
        title: copy.overview,
        subtitle: 'Workspace dashboard and risk hub',
        category: 'Navigation',
        icon: LayoutDashboard,
        shortcut: 'G O',
        onSelect: () => {
          navigate('/');
          onClose();
        },
      },
      {
        id: 'nav-cases',
        title: copy.cases,
        subtitle: 'Assessment cases directory',
        category: 'Navigation',
        icon: ClipboardCheck,
        shortcut: 'G C',
        onSelect: () => {
          navigate('/cases');
          onClose();
        },
      },
      {
        id: 'nav-new-case',
        title: copy.newRequest,
        subtitle: 'Create a new talent assessment case',
        category: 'Navigation',
        icon: Plus,
        onSelect: () => {
          navigate('/cases/new');
          onClose();
        },
      },
      {
        id: 'nav-tasks',
        title: copy.tasks,
        subtitle: 'Assigned decisions and pending queue',
        category: 'Navigation',
        icon: ListTodo,
        onSelect: () => {
          navigate('/tasks');
          onClose();
        },
      },
      {
        id: 'nav-employees',
        title: copy.employees,
        subtitle: 'Talent scope and Employee 360 history',
        category: 'Navigation',
        icon: Users,
        onSelect: () => {
          navigate('/employees');
          onClose();
        },
      },
      {
        id: 'nav-development',
        title: copy.development,
        subtitle: 'Post-assessment development actions & follow-ups',
        category: 'Navigation',
        icon: Sparkles,
        onSelect: () => {
          navigate('/development');
          onClose();
        },
      },
      {
        id: 'nav-insights',
        title: copy.insights,
        subtitle: 'Analytics, pipeline metrics, and reports builder',
        category: 'Navigation',
        icon: BarChart3,
        onSelect: () => {
          navigate('/insights');
          onClose();
        },
      },
      {
        id: 'nav-notifications',
        title: 'Notifications',
        subtitle: 'System alerts and SLA updates',
        category: 'Navigation',
        icon: Bell,
        onSelect: () => {
          navigate('/notifications');
          onClose();
        },
      },
      {
        id: 'nav-admin',
        title: copy.admin,
        subtitle: 'System policy configuration and evaluation standards',
        category: 'Navigation',
        icon: Settings2,
        onSelect: () => {
          navigate('/admin');
          onClose();
        },
      },
    ];

    if (PILOT_FLAGS.calibration) {
      items.push({
        id: 'nav-calibration',
        title: copy.calibration,
        subtitle: 'Cross-department outcome balancing (Phase 2)',
        category: 'Navigation',
        icon: Sparkles,
        onSelect: () => {
          navigate('/calibration');
          onClose();
        },
      });
    }

    return items;
  }, [navigate, onClose]);

  const caseItems: PaletteItem[] = useMemo(() => {
    if (!cases) return [];
    return cases.map((c) => ({
      id: `case-${c.id}`,
      title: `${c.caseCode} · ${c.employeeName}`,
      subtitle: `${c.department} · Target: ${c.targetRole} (${c.targetLevel})`,
      badge: statusLabels[c.status] ?? c.status,
      badgeTone: statusTone(c.status),
      category: 'Recent cases',
      icon: ClipboardCheck,
      onSelect: () => {
        navigate(`/cases/${c.id}`);
        onClose();
      },
    }));
  }, [cases, navigate, onClose]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...navItems, ...caseItems.slice(0, 6)];
    }

    const matchedNav = navItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        Boolean(item.subtitle && item.subtitle.toLowerCase().includes(q)),
    );

    const matchedCases = caseItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        Boolean(item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        Boolean(item.badge && item.badge.toLowerCase().includes(q)),
    );

    return [...matchedNav, ...matchedCases];
  }, [query, navItems, caseItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (filteredItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          selected.onSelect();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input-wrap">
          <Search size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search cases…"
            aria-autocomplete="list"
          />
          {query ? (
            <button
              type="button"
              className="palette-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd className="palette-kbd">ESC</kbd>
          )}
        </div>

        <div className="palette-body">
          {filteredItems.length === 0 ? (
            <div className="palette-empty">
              <Search size={22} />
              <strong>No matching commands or cases</strong>
              <span>Try searching for another term or destination.</span>
            </div>
          ) : (
            <ul ref={listRef} className="palette-list" role="listbox">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                const isFirstOfCategory =
                  index === 0 || filteredItems[index - 1]?.category !== item.category;

                return (
                  <React.Fragment key={item.id}>
                    {isFirstOfCategory && (
                      <li className="palette-group-heading" role="presentation">
                        {item.category}
                      </li>
                    )}
                    <li
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                      className={`palette-item ${isSelected ? 'selected' : ''}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => item.onSelect()}
                    >
                      <div className="palette-item-icon">
                        <Icon size={16} />
                      </div>
                      <div className="palette-item-content">
                        <strong>{item.title}</strong>
                        {item.subtitle && <small>{item.subtitle}</small>}
                      </div>
                      {item.badge && (
                        <span className={`status-badge ${item.badgeTone ?? 'info'} palette-badge`}>
                          {item.badge}
                        </span>
                      )}
                      {item.shortcut && <span className="palette-shortcut">{item.shortcut}</span>}
                      {isSelected && <CornerDownLeft size={14} className="palette-enter-hint" />}
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}
        </div>

        <div className="palette-footer">
          <div className="palette-footer-hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="palette-footer-hint">
            <kbd>↵</kbd>
            <span>Select</span>
          </div>
          <div className="palette-footer-hint">
            <kbd>ESC</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShortcutsHelpDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
      >
        <div className="shortcuts-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={18} style={{ color: 'var(--indigo)' }} />
            <h2 id="shortcuts-dialog-title" style={{ margin: 0, fontSize: '16px' }}>
              Keyboard shortcuts
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="shortcuts-dialog-body">
          <section className="shortcuts-section">
            <span className="shortcuts-section-title">Navigation</span>
            <div className="shortcut-row">
              <span>Go to Overview</span>
              <div className="shortcut-keys">
                <kbd>G</kbd>
                <span>then</span>
                <kbd>O</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span>Go to Assessments (Cases)</span>
              <div className="shortcut-keys">
                <kbd>G</kbd>
                <span>then</span>
                <kbd>C</kbd>
              </div>
            </div>
          </section>

          <section className="shortcuts-section">
            <span className="shortcuts-section-title">General</span>
            <div className="shortcut-row">
              <span>Command palette</span>
              <div className="shortcut-keys">
                <kbd>⌘</kbd>
                <kbd>K</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span>Shortcuts reference</span>
              <div className="shortcut-keys">
                <kbd>?</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span>Close dialog / modal</span>
              <div className="shortcut-keys">
                <kbd>ESC</kbd>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

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
      // Check if typing in input, textarea, select, or contentEditable
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isInput =
        target?.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select';

      // ⌘K or Ctrl+K opens command palette everywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      // Ignore single-key shortcuts while typing in editable elements
      if (isInput) return;

      // Ignore modifier keys for sequential shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
        const key = e.key.toLowerCase();
        if (key === 'c') {
          e.preventDefault();
          gPressed = false;
          if (gTimer) window.clearTimeout(gTimer);
          navigate('/cases');
        } else if (key === 'o') {
          e.preventDefault();
          gPressed = false;
          if (gTimer) window.clearTimeout(gTimer);
          navigate('/');
        } else {
          gPressed = false;
          if (gTimer) window.clearTimeout(gTimer);
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  ClipboardCheck,
  CornerDownLeft,
  Keyboard,
  LayoutDashboard,
  ListTodo,
  Plus,
  Scale,
  Search,
  Settings2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { canAccessRoute, getSession } from '../lib/auth';
import { PILOT_FLAGS } from '../lib/flags';
import { copy, statusLabels, statusTone } from '../lib/labels';
import { queryKeys } from '../lib/query-keys';
import { useFocusTrap } from '../hooks/use-focus-trap';

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
  const user = getSession();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useFocusTrap(isOpen, dialogRef, onClose);

  const canBrowseCases = canAccessRoute(user, 'cases');

  // Server-side search: only the 10 best matches are fetched, never the whole list.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: casesPage } = useQuery({
    queryKey: [...queryKeys.cases(), 'palette', debouncedQuery],
    queryFn: () => api.casesPage(debouncedQuery, 10, 0),
    enabled: isOpen && canBrowseCases,
    staleTime: 30_000,
  });
  const cases = casesPage?.items;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const navItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    if (canAccessRoute(user, 'overview')) {
      items.push({
        id: 'nav-overview',
        title: copy.overview,
        subtitle: 'Workspace dashboard and action hub',
        category: 'Navigation',
        icon: LayoutDashboard,
        shortcut: 'G O',
        onSelect: () => {
          navigate('/');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'tasks')) {
      items.push({
        id: 'nav-tasks',
        title: copy.tasks,
        subtitle: 'Assigned decisions and pending queue',
        category: 'Navigation',
        icon: ListTodo,
        onSelect: () => {
          navigate('/tasks');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'cases')) {
      items.push({
        id: 'nav-cases',
        title: copy.cases,
        subtitle: 'Assessment cases directory',
        category: 'Navigation',
        icon: ClipboardCheck,
        shortcut: 'G C',
        onSelect: () => {
          navigate('/assessments');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'new-case')) {
      items.push({
        id: 'nav-new-case',
        title: copy.newRequest,
        subtitle: 'Create a new assessment request',
        category: 'Navigation',
        icon: Plus,
        onSelect: () => {
          navigate('/cases/new');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'assessor')) {
      items.push({
        id: 'nav-assessor',
        title: 'My assessments',
        subtitle: 'Assigned assessor sessions and evidence drafts',
        category: 'Navigation',
        icon: UserCheck,
        onSelect: () => {
          navigate('/assessor');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'employees')) {
      items.push({
        id: 'nav-employees',
        title: copy.employees,
        subtitle: 'Talent scope and Employee 360 history',
        category: 'Navigation',
        icon: Users,
        onSelect: () => {
          navigate('/employees');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'development')) {
      items.push({
        id: 'nav-development',
        title: copy.development,
        subtitle: 'Post-assessment development actions & follow-ups',
        category: 'Navigation',
        icon: TrendingUp,
        onSelect: () => {
          navigate('/development');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'insights')) {
      items.push({
        id: 'nav-insights',
        title: copy.insights,
        subtitle: 'Analytics, pipeline metrics, and reports',
        category: 'Navigation',
        icon: BarChart3,
        onSelect: () => {
          navigate('/insights');
          onClose();
        },
      });
    }
    if (PILOT_FLAGS.calibration && canAccessRoute(user, 'calibration')) {
      items.push({
        id: 'nav-calibration',
        title: copy.calibration,
        subtitle: 'Cross-department 9-box outcome balancing',
        category: 'Navigation',
        icon: Scale,
        onSelect: () => {
          navigate('/calibration');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'my-result')) {
      items.push({
        id: 'nav-my-result',
        title: 'My results',
        subtitle: 'Released assessment outcomes & feedback',
        category: 'Navigation',
        icon: ClipboardCheck,
        onSelect: () => {
          navigate('/my-result');
          onClose();
        },
      });
    }
    if (canAccessRoute(user, 'admin')) {
      items.push({
        id: 'nav-admin',
        title: copy.admin,
        subtitle: 'Accounts, roles matrix, policies & audit ledger',
        category: 'Navigation',
        icon: Settings2,
        onSelect: () => {
          navigate('/admin');
          onClose();
        },
      });
    }

    return items;
  }, [navigate, onClose, user]);

  const caseItems: PaletteItem[] = useMemo(() => {
    if (!cases || !canBrowseCases) return [];
    return cases.map((c) => ({
      id: `case-${c.id}`,
      title: `${c.caseCode} · ${c.employeeName}`,
      subtitle: `${c.department} · Target: ${c.targetRole}${c.targetLevel ? ` (${c.targetLevel})` : ''}`,
      badge: statusLabels[c.status] ?? c.status,
      badgeTone: statusTone(c.status),
      category: 'Recent cases',
      icon: ClipboardCheck,
      onSelect: () => {
        navigate(`/cases/${c.id}`);
        onClose();
      },
    }));
  }, [cases, canBrowseCases, navigate, onClose]);

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

    // Case results come from the server search for the debounced query; while the
    // next search loads, keep only rows that still match what is typed.
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (selected) selected.onSelect();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const activeItem = filteredItems[selectedIndex];

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="palette-input-wrap">
          <Search size={18} className="palette-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={filteredItems.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={activeItem ? `palette-opt-${activeItem.id}` : undefined}
            aria-autocomplete="list"
            className="palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a destination or search cases…"
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
            <div className="palette-empty" role="status">
              <Search size={22} />
              <strong>No matching commands or cases</strong>
              <span>Try searching for another destination or case number.</span>
            </div>
          ) : (
            <ul id="command-palette-list" ref={listRef} className="palette-list" role="listbox">
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
                      id={`palette-opt-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                      className={`palette-item ${isSelected ? 'selected' : ''}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => item.onSelect()}
                    >
                      <div className="palette-item-icon" aria-hidden="true">
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(isOpen, cardRef, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
      >
        <div className="shortcuts-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={18} style={{ color: 'var(--primary)' }} />
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
              <span>Go to Assessments</span>
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

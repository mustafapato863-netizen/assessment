const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const INLINE_ICONS = {
  menu: `<path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  search: `<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  home: `<path d="M4 10.5 12 4l8 6.5V20h-6v-5H10v5H4v-9.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  assessment: `<rect x="4" y="3.5" width="16" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 8h8M8 12h5M8 16h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  employees: `<circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19c.7-3.3 2.5-5 5.5-5s4.8 1.7 5.5 5M14 15c2.7-.4 4.7.9 5.6 3.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  calibration: `<path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 5v4M16 15v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  report: `<path d="M5 20V10M12 20V4M19 20v-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  task: `<path d="m6 12 3 3 8-8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  palette: `<path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.3a1.7 1.7 0 0 0 0-3.4h-1.1a2 2 0 0 1 0-4H16a4.5 4.5 0 0 0 0-9h-4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="6.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12" r="1" fill="currentColor"/>`,
  components: `<rect x="4" y="4" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="4" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="14" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  pattern: `<path d="M4 6h16M4 12h10M4 18h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="17.5" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  icons: `<path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  database: `<ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  docs: `<path d="M6 3.5h8l4 4V20.5H6V3.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3.5v4h4M9 12h6M9 16h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  bell: `<path d="M6.5 10.5c0-3 1.8-5.5 5.5-5.5s5.5 2.5 5.5 5.5v3.2l1.5 2.8H5l1.5-2.8v-3.2Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 19h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  sun: `<circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.7 5.7l1.4 1.4M16.9 16.9l1.4 1.4M18.3 5.7l-1.4 1.4M7.1 16.9l-1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  moon: `<path d="M19.4 15.1A7.5 7.5 0 0 1 8.9 4.6 8.4 8.4 0 1 0 19.4 15.1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  chevron: `<path d="m8 10 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  arrow: `<path d="M5 12h14M14 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  plus: `<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  check: `<path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  upload: `<path d="M12 16V5M8 9l4-4 4 4M5 15.5v3h14v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  help: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1.1-1.4 2M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  settings: `<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m19.2 13.5 1.1.8-1.7 3-1.3-.5a7.8 7.8 0 0 1-1.8 1l-.2 1.4h-3.5l-.2-1.4a7.8 7.8 0 0 1-1.8-1l-1.3.5-1.7-3 1.1-.8a7.6 7.6 0 0 1 0-2.1l-1.1-.8 1.7-3 1.3.5a7.8 7.8 0 0 1 1.8-1l.2-1.4h3.5l.2 1.4a7.8 7.8 0 0 1 1.8 1l1.3-.5 1.7 3-1.1.8a7.6 7.6 0 0 1 0 2.1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
};

const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* file:// mode */ }
  },
};

const toast = (message, tone = 'info') => {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  element.classList.add('show');
  clearTimeout(window.__afToast);
  window.__afToast = setTimeout(() => element.classList.remove('show'), 2200);
};

const setSidebarState = (collapsed) => {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const control = $('#collapseSidebar');
  if (control) {
    control.setAttribute('aria-expanded', String(!collapsed));
    control.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    control.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  }
  store.set('af-sidebar-collapsed', collapsed ? '1' : '0');
};

const setMobileNavState = (open) => {
  document.body.classList.toggle('mobile-nav-open', open);
  const control = $('#mobileMenu');
  if (control) {
    control.setAttribute('aria-expanded', String(open));
    control.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
};

function setupShell() {
  const nav = $('#primaryNavigation') || $('.nav-scroll');
  if (nav) nav.id = 'primaryNavigation';

  const collapse = $('#collapseSidebar');
  collapse?.setAttribute('aria-controls', 'primaryNavigation');
  collapse?.addEventListener('click', () => setSidebarState(!document.body.classList.contains('sidebar-collapsed')));
  setSidebarState(store.get('af-sidebar-collapsed') === '1');

  const mobileMenu = $('#mobileMenu');
  mobileMenu?.setAttribute('aria-controls', 'primaryNavigation');
  const scrim = document.createElement('div');
  scrim.className = 'mobile-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  document.body.appendChild(scrim);
  mobileMenu?.addEventListener('click', () => setMobileNavState(!document.body.classList.contains('mobile-nav-open')));
  scrim.addEventListener('click', () => setMobileNavState(false));

  const navItems = $$('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      navItems.forEach((candidate) => candidate.classList.remove('active'));
      item.classList.add('active');
      setMobileNavState(false);
    });
  });

  const sections = $$('.section[id]');
  if ('IntersectionObserver' in window && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const active = navItems.find((item) => item.getAttribute('href') === `#${visible.target.id}`);
      if (!active) return;
      navItems.forEach((item) => item.classList.remove('is-observed'));
      active.classList.add('is-observed');
    }, { rootMargin: '-14% 0px -68% 0px', threshold: [0.1, 0.35, 0.7] });
    sections.forEach((section) => observer.observe(section));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMobileNavState(false);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $('#searchInput')?.focus();
    }
  });
}

function setupIcons() {
  $$('svg > use').forEach((use) => {
    const reference = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
    const name = reference.split('#').pop();
    const svg = use.closest('svg');
    if (!svg || !INLINE_ICONS[name]) return;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = INLINE_ICONS[name];
  });
  $$('[aria-label]').forEach((control) => {
    if (!control.getAttribute('title') && (control.tagName === 'BUTTON' || control.tagName === 'A')) control.title = control.getAttribute('aria-label');
  });
}

function setupTheme() {
  const themeButton = $('#themeToggle');
  const themeSvg = $('#themeToggle svg');
  const update = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (themeSvg && INLINE_ICONS[dark ? 'sun' : 'moon']) themeSvg.innerHTML = INLINE_ICONS[dark ? 'sun' : 'moon'];
    themeButton?.setAttribute('aria-pressed', String(dark));
    themeButton?.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  const savedTheme = store.get('af-theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  update();
  themeButton?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('af-theme', next);
    update();
    toast(`${next === 'dark' ? 'Dark' : 'Light'} theme enabled`);
  });
}

function setupSearch() {
  const input = $('#searchInput');
  if (!input) return;
  const searchBox = input.closest('.top-search');
  const resultPanel = $('#searchResults') || (() => {
    const panel = document.createElement('div');
    panel.id = 'searchResults';
    panel.className = 'search-results';
    panel.setAttribute('role', 'listbox');
    searchBox?.appendChild(panel);
    return panel;
  })();
  resultPanel.hidden = true;
  const sections = $$('.section[id]');

  const entries = sections.map((section) => ({
    id: section.id,
    title: $('.section-title', section)?.textContent.trim() || section.id,
    description: $('.section-copy', section)?.textContent.trim() || 'Design system section',
    text: section.textContent.toLowerCase(),
  }));

  const closeResults = () => {
    resultPanel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const openSection = (entry) => {
    const section = document.getElementById(entry.id);
    if (!section) return;
    closeResults();
    input.value = '';
    sections.forEach((candidate) => candidate.classList.remove('search-hidden'));
    section.classList.add('search-match');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => section.classList.remove('search-match'), 700);
  };

  const render = (query) => {
    const normalized = query.trim().toLowerCase();
    const matches = entries.filter((entry) => !normalized || `${entry.title} ${entry.description} ${entry.text}`.includes(normalized)).slice(0, 8);
    sections.forEach((section) => section.classList.toggle('search-hidden', Boolean(normalized) && !matches.some((entry) => entry.id === section.id)));
    resultPanel.replaceChildren();
    if (!normalized) { closeResults(); return; }
    input.setAttribute('aria-expanded', 'true');
    resultPanel.hidden = false;
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = 'No design-system section matches that search.';
      resultPanel.appendChild(empty);
      return;
    }
    matches.forEach((entry) => {
      const result = document.createElement('button');
      result.className = 'search-result';
      result.type = 'button';
      result.setAttribute('role', 'option');
      result.innerHTML = `<span class="result-icon">#</span><span><strong></strong><span></span></span>`;
      $('strong', result).textContent = entry.title;
      $('span span', result).textContent = entry.description;
      result.addEventListener('click', () => openSection(entry));
      resultPanel.appendChild(result);
    });
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => { if (input.value.trim()) render(input.value); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      sections.forEach((section) => section.classList.remove('search-hidden'));
      closeResults();
    }
    if (event.key === 'Enter' && resultPanel.querySelector('.search-result')) resultPanel.querySelector('.search-result').click();
  });
  document.addEventListener('click', (event) => {
    if (!searchBox?.contains(event.target)) closeResults();
  });
}

function setupComponents() {
  $$('.swatch').forEach((swatch) => swatch.addEventListener('click', async () => {
    const hex = swatch.dataset.hex;
    try { await navigator.clipboard.writeText(hex); } catch { /* clipboard can be blocked on file:// */ }
    toast(`${hex} copied`);
  }));

  $$('.toggle').forEach((toggle) => {
    if (!toggle.hasAttribute('role')) toggle.setAttribute('role', 'switch');
    if (!toggle.hasAttribute('aria-checked')) toggle.setAttribute('aria-checked', String(toggle.classList.contains('on')));
    toggle.setAttribute('tabindex', '0');
    const update = () => {
      const enabled = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(enabled));
      toggle.classList.toggle('on', enabled);
      toast(`${toggle.getAttribute('aria-label') || 'Setting'} ${enabled ? 'enabled' : 'disabled'}`);
    };
    toggle.addEventListener('click', update);
    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); update(); }
    });
  });

  $$('.tabs').forEach((tabList) => {
    $$('.tab', tabList).forEach((tab) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
      tab.addEventListener('click', () => {
        $$('.tab', tabList).forEach((candidate) => {
          candidate.classList.remove('active');
          candidate.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        toast(`${tab.textContent.trim()} tab selected`);
      });
    });
  });

  $$('[data-toast]').forEach((button) => button.addEventListener('click', () => toast(button.dataset.toast)));
  $$('.quick-action, .btn').forEach((button) => {
    if (button.dataset.simAction) return;
    if (button.dataset.toast || button.tagName !== 'BUTTON') return;
    button.addEventListener('click', () => {
      const label = button.textContent.trim().replace(/\s+/g, ' ');
      if (label) toast(`${label} action preview`);
    });
  });
}

function setupLoadingButtons() {
  $$('.btn-primary:not([data-sim-action])').forEach((button) => button.addEventListener('click', () => {
    if (button.disabled || button.classList.contains('is-loading')) return;
    const original = button.innerHTML;
    const label = button.textContent.trim() || 'Processing';
    button.classList.add('is-loading');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', `${label}, loading`);
    button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>Loading...</span>`;
    setTimeout(() => {
      button.innerHTML = original;
      button.classList.remove('is-loading');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-label', label);
      toast(`${label} completed`, 'success');
    }, 900);
  }));
}

setupIcons();
setupShell();
setupTheme();
setupSearch();
setupComponents();
setupLoadingButtons();

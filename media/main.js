(function () {
  const vscode = acquireVsCodeApi();
  let config = window.__deckConfig || { columns: 4, buttons: [], mode: 'sidebar' };
  const running = new Set((window.__deckRunning || []).map(String));
  const statuses = new Map();
  for (const entry of window.__deckStatuses || []) {
    if (Array.isArray(entry) && entry.length === 2) {
      statuses.set(String(entry[0]), entry[1]);
    }
  }
  const root = document.getElementById('root');
  const savedState = (vscode.getState && vscode.getState()) || {};
  const collapsedCategories = new Set(savedState.collapsed || []);

  function saveState() {
    if (vscode.setState) {
      vscode.setState({ collapsed: Array.from(collapsedCategories) });
    }
  }

  function renderIcon(icon) {
    if (!icon || typeof icon !== 'string') return null;
    const trimmed = icon
      .trim()
      .replace(/^<\?xml[^?]*\?>\s*/i, '')
      .replace(/^<!DOCTYPE[^>]*>\s*/i, '');
    if (!trimmed) return null;
    const el = document.createElement('div');
    el.className = 'deck-icon';
    if (/^<svg[\s>]/i.test(trimmed)) {
      el.innerHTML = trimmed;
      const svg = el.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.classList.add('deck-icon-svg');
      }
      return el;
    }
    if (/^(https?:|data:|\/|\.|[a-zA-Z]:[\\/])/.test(trimmed)) {
      const img = document.createElement('img');
      img.src = trimmed;
      img.onerror = () => {
        el.innerHTML = '';
        el.classList.add('deck-icon-missing');
        el.textContent = '?';
      };
      el.appendChild(img);
      return el;
    }
    el.textContent = trimmed;
    return el;
  }

  function renderPlaceholder() {
    const wrap = document.createElement('div');
    wrap.className = 'deck-placeholder';
    const msg = document.createElement('p');
    msg.textContent = 'Deck is configured to open in a floating window.';
    const btn = document.createElement('button');
    btn.className = 'open-floating';
    btn.textContent = 'Open floating window';
    btn.onclick = () => vscode.postMessage({ type: 'openFloating' });
    wrap.appendChild(msg);
    wrap.appendChild(btn);
    return wrap;
  }

  function renderEmpty() {
    const wrap = document.createElement('div');
    wrap.className = 'deck-empty';
    const intro = document.createElement('p');
    intro.textContent = 'No buttons configured.';
    wrap.appendChild(intro);
    const editBtn = document.createElement('button');
    editBtn.className = 'open-floating';
    editBtn.textContent = 'Open visual editor';
    editBtn.onclick = () => vscode.postMessage({ type: 'editButtons' });
    wrap.appendChild(editBtn);
    const jsonLink = document.createElement('a');
    jsonLink.textContent = 'or edit JSON directly';
    jsonLink.onclick = (e) => {
      e.preventDefault();
      vscode.postMessage({ type: 'editConfig' });
    };
    wrap.appendChild(jsonLink);
    return wrap;
  }

  function measureButton(btn) {
    const content = btn.querySelector('.deck-content');
    if (!content) return;
    const style = getComputedStyle(btn);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const available = btn.clientHeight - paddingY;
    if (available <= 0) return;
    const overflow = content.offsetHeight - available;
    if (overflow > 1) {
      btn.classList.add('deck-overflow');
      btn.style.setProperty('--deck-scroll', overflow + 'px');
      const duration = Math.max(2, overflow / 15);
      btn.style.setProperty('--deck-scroll-duration', duration + 's');
    } else {
      btn.classList.remove('deck-overflow');
      btn.style.removeProperty('--deck-scroll');
      btn.style.removeProperty('--deck-scroll-duration');
    }
  }

  function renderButton(button, index) {
    const el = document.createElement('button');
    el.className = 'deck-button';
    el.type = 'button';
    el.dataset.deckIndex = String(index);
    if (button.color) el.style.borderTopColor = button.color;
    const content = document.createElement('div');
    content.className = 'deck-content';
    const iconEl = renderIcon(button.icon);
    if (iconEl) content.appendChild(iconEl);
    const title = document.createElement('div');
    title.className = 'deck-title';
    title.textContent = button.title || '';
    content.appendChild(title);
    el.appendChild(content);

    const overlay = document.createElement('div');
    overlay.className = 'deck-running-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const spinner = document.createElement('div');
    spinner.className = 'deck-spinner';
    const stop = document.createElement('div');
    stop.className = 'deck-stop-icon';
    overlay.appendChild(spinner);
    overlay.appendChild(stop);
    el.appendChild(overlay);

    const statusDot = document.createElement('div');
    statusDot.className = 'deck-status-dot';
    statusDot.setAttribute('aria-hidden', 'true');
    el.appendChild(statusDot);

    el.onclick = () => {
      const key = String(index);
      if (running.has(key)) {
        vscode.postMessage({ type: 'cancel', key: key });
      } else {
        vscode.postMessage({ type: 'run', index: index });
      }
    };
    el.addEventListener('mouseenter', () => measureButton(el));
    applyRunningState(el);
    return el;
  }

  function applyRunningState(btn) {
    const key = btn.dataset.deckIndex;
    if (key !== undefined && running.has(key)) {
      btn.classList.add('deck-running');
      btn.setAttribute('aria-busy', 'true');
      btn.title = 'Click to stop';
    } else {
      btn.classList.remove('deck-running');
      btn.removeAttribute('aria-busy');
      btn.removeAttribute('title');
    }
    applyStatus(btn);
  }

  function applyStatus(btn) {
    const key = btn.dataset.deckIndex;
    const dot = btn.querySelector('.deck-status-dot');
    if (!dot) return;
    dot.classList.remove('status-success', 'status-failure', 'status-cancelled');
    if (key === undefined) return;
    const status = statuses.get(key);
    if (status === 'success') dot.classList.add('status-success');
    else if (status === 'failure') dot.classList.add('status-failure');
    else if (status === 'cancelled') dot.classList.add('status-cancelled');
  }

  function syncRunningDom() {
    const buttons = root.querySelectorAll('.deck-button[data-deck-index]');
    buttons.forEach(applyRunningState);
  }

  function syncStatusDom() {
    const buttons = root.querySelectorAll('.deck-button[data-deck-index]');
    buttons.forEach(applyStatus);
  }

  function renderGrid(items) {
    const grid = document.createElement('div');
    grid.className = 'deck-grid';
    grid.style.gridTemplateColumns = `repeat(${config.columns || 4}, 1fr)`;
    for (const { button, index } of items) {
      grid.appendChild(renderButton(button, index));
    }
    return grid;
  }

  function renderCategorySection(category, items) {
    const section = document.createElement('div');
    section.className = 'deck-section';
    const collapsed = collapsedCategories.has(category);
    if (collapsed) section.classList.add('deck-collapsed');
    const header = document.createElement('button');
    header.className = 'deck-category';
    header.type = 'button';
    const chevron = document.createElement('span');
    chevron.className = 'deck-chevron';
    chevron.textContent = '\u25BE';
    const label = document.createElement('span');
    label.className = 'deck-category-label';
    label.textContent = category;
    header.appendChild(chevron);
    header.appendChild(label);
    header.onclick = () => {
      if (collapsedCategories.has(category)) {
        collapsedCategories.delete(category);
        section.classList.remove('deck-collapsed');
      } else {
        collapsedCategories.add(category);
        section.classList.add('deck-collapsed');
      }
      saveState();
    };
    section.appendChild(header);
    section.appendChild(renderGrid(items));
    return section;
  }

  function renderAll() {
    const frag = document.createDocumentFragment();
    const buttons = config.buttons || [];
    const uncategorized = [];
    const byCategory = new Map();
    const order = [];
    buttons.forEach((button, index) => {
      const cat = typeof button.category === 'string' ? button.category.trim() : '';
      if (!cat) {
        uncategorized.push({ button, index });
      } else {
        if (!byCategory.has(cat)) {
          byCategory.set(cat, []);
          order.push(cat);
        }
        byCategory.get(cat).push({ button, index });
      }
    });
    if (uncategorized.length) {
      frag.appendChild(renderGrid(uncategorized));
    }
    for (const cat of order) {
      frag.appendChild(renderCategorySection(cat, byCategory.get(cat)));
    }
    // drop any remembered collapse entries for categories that no longer exist
    for (const cat of Array.from(collapsedCategories)) {
      if (!byCategory.has(cat)) collapsedCategories.delete(cat);
    }
    saveState();
    return frag;
  }

  function render() {
    root.innerHTML = '';
    if (config._placeholder) {
      root.appendChild(renderPlaceholder());
      return;
    }
    if (!config.buttons || config.buttons.length === 0) {
      root.appendChild(renderEmpty());
      return;
    }
    root.appendChild(renderAll());
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'config') {
      config = msg.config;
      render();
    } else if (msg.type === 'runState') {
      running.clear();
      const next = Array.isArray(msg.running) ? msg.running : [];
      for (const key of next) running.add(String(key));
      syncRunningDom();
    } else if (msg.type === 'statuses') {
      statuses.clear();
      const list = Array.isArray(msg.statuses) ? msg.statuses : [];
      for (const entry of list) {
        if (Array.isArray(entry) && entry.length === 2) {
          statuses.set(String(entry[0]), entry[1]);
        }
      }
      syncStatusDom();
    }
  });

  render();
})();

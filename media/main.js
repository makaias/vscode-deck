(function () {
  const vscode = acquireVsCodeApi();
  let config = window.__deckConfig || { columns: 4, buttons: [], mode: 'sidebar' };
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
    if (/^(https?:|data:|\/|\.)/.test(trimmed)) {
      const img = document.createElement('img');
      img.src = trimmed;
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
    const link = document.createElement('a');
    link.textContent = 'Edit configuration';
    link.onclick = (e) => {
      e.preventDefault();
      vscode.postMessage({ type: 'editConfig' });
    };
    wrap.appendChild(document.createTextNode('No buttons configured. '));
    wrap.appendChild(link);
    return wrap;
  }

  function renderButton(button, index) {
    const el = document.createElement('button');
    el.className = 'deck-button';
    el.type = 'button';
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
    el.onclick = () => vscode.postMessage({ type: 'run', index: index });
    return el;
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
      requestAnimationFrame(() => requestAnimationFrame(detectOverflow));
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

  function detectOverflow() {
    root.querySelectorAll('.deck-button').forEach((btn) => {
      const content = btn.querySelector('.deck-content');
      if (!content) return;
      const style = getComputedStyle(btn);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const available = btn.clientHeight - paddingY;
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
    });
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
    requestAnimationFrame(() => requestAnimationFrame(detectOverflow));
  }

  window.addEventListener('resize', () => {
    requestAnimationFrame(() => requestAnimationFrame(detectOverflow));
  });

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'config') {
      config = msg.config;
      render();
    }
  });

  render();
})();

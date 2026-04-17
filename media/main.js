(function () {
  const vscode = acquireVsCodeApi();
  let config = window.__deckConfig || { columns: 4, buttons: [], mode: 'sidebar' };
  const root = document.getElementById('root');

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

  function renderGrid() {
    const grid = document.createElement('div');
    grid.className = 'deck-grid';
    grid.style.gridTemplateColumns = `repeat(${config.columns || 4}, 1fr)`;
    (config.buttons || []).forEach((button, i) => {
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
      el.onclick = () => vscode.postMessage({ type: 'run', index: i });
      grid.appendChild(el);
    });
    return grid;
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
    root.appendChild(renderGrid());
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

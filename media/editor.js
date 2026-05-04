(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root');

  let state = { mode: 'sidebar', columns: 4, iconSize: undefined, groups: [] };
  let dirty = false;
  let saveStatus = null;
  let expandedUid = -1;
  let dragUid = -1;
  let nextUid = 1;

  function assignUid(btn) {
    if (btn.__uid === undefined) {
      Object.defineProperty(btn, '__uid', {
        value: nextUid++,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    }
    return btn.__uid;
  }

  function loadFromConfig(config) {
    const c = config || {};
    state.mode = c.mode === 'floating' ? 'floating' : 'sidebar';
    state.columns = typeof c.columns === 'number' ? c.columns : undefined;
    state.iconSize = typeof c.iconSize === 'number' ? c.iconSize : undefined;

    const map = new Map();
    const order = [''];
    map.set('', { name: '', buttons: [] });
    for (const btn of c.buttons || []) {
      const cat = typeof btn.category === 'string' ? btn.category.trim() : '';
      if (!map.has(cat)) {
        map.set(cat, { name: cat, buttons: [] });
        order.push(cat);
      }
      const copy = Object.assign({}, btn);
      delete copy.category;
      assignUid(copy);
      map.get(cat).buttons.push(copy);
    }
    state.groups = order.map((n) => map.get(n));
  }

  function flattenToConfig() {
    const buttons = [];
    for (const g of state.groups) {
      for (const btn of g.buttons) {
        const copy = Object.assign({}, btn);
        delete copy.__uid;
        if (g.name) copy.category = g.name;
        buttons.push(copy);
      }
    }
    const out = { mode: state.mode, buttons };
    out.columns = typeof state.columns === 'number' ? state.columns : 4;
    if (typeof state.iconSize === 'number') out.iconSize = state.iconSize;
    return out;
  }

  function findByUid(uid) {
    for (let gi = 0; gi < state.groups.length; gi++) {
      const bi = state.groups[gi].buttons.findIndex((b) => b.__uid === uid);
      if (bi !== -1) return { gi, bi };
    }
    return null;
  }

  function totalButtons() {
    return state.groups.reduce((acc, g) => acc + g.buttons.length, 0);
  }

  function markDirty() {
    if (!dirty) {
      dirty = true;
      saveStatus = null;
      renderHeaderOnly();
    }
  }

  function renderHeaderOnly() {
    const header = root.querySelector('.editor-header');
    if (header) header.replaceWith(renderHeader());
  }

  function setConfig(next) {
    loadFromConfig(next);
    dirty = false;
    saveStatus = null;
    expandedUid = -1;
    render();
  }

  function save() {
    if (!dirty) return;
    saveStatus = 'saving';
    renderHeaderOnly();
    vscode.postMessage({ type: 'save', config: flattenToConfig() });
  }

  function reload() {
    if (dirty && !confirm('Discard unsaved changes and reload from file?')) return;
    vscode.postMessage({ type: 'reload' });
  }

  // === element factories ===

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function iconBtn(label, title, onClick, opts) {
    const b = el('button', 'icon-btn');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    if (opts && opts.danger) b.classList.add('danger');
    if (opts && opts.primary) b.classList.add('primary');
    if (opts && opts.disabled) b.disabled = true;
    b.onclick = onClick;
    return b;
  }

  function field(label, value, onInput, opts) {
    const wrap = el('div', 'field');
    if (label) wrap.appendChild(el('label', 'field-label', label));
    const input = document.createElement('input');
    input.type = (opts && opts.type) || 'text';
    if (opts && opts.placeholder) input.placeholder = opts.placeholder;
    input.value = value == null ? '' : String(value);
    input.oninput = () => onInput(input.value);
    wrap.appendChild(input);
    return wrap;
  }

  function numField(label, value, onChange, opts) {
    const wrap = el('div', 'field');
    wrap.appendChild(el('label', 'field-label', label));
    const input = document.createElement('input');
    input.type = 'number';
    if (opts && opts.min !== undefined) input.min = String(opts.min);
    if (opts && opts.step !== undefined) input.step = String(opts.step);
    if (value !== undefined && value !== null) input.value = String(value);
    if (opts && opts.placeholder) input.placeholder = opts.placeholder;
    input.oninput = () => {
      const raw = input.value;
      if (raw === '') {
        onChange(undefined);
      } else {
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }
    };
    wrap.appendChild(input);
    return wrap;
  }

  function selectField(label, value, options, onChange) {
    const wrap = el('div', 'field');
    if (label) wrap.appendChild(el('label', 'field-label', label));
    const sel = document.createElement('select');
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
    sel.value = value;
    sel.onchange = () => onChange(sel.value);
    wrap.appendChild(sel);
    return wrap;
  }

  function textareaField(label, value, onInput, opts) {
    const wrap = el('div', 'field');
    wrap.appendChild(el('label', 'field-label', label));
    const ta = document.createElement('textarea');
    ta.value = value == null ? '' : String(value);
    ta.rows = (opts && opts.rows) || 2;
    if (opts && opts.placeholder) ta.placeholder = opts.placeholder;
    ta.oninput = () => onInput(ta.value);
    wrap.appendChild(ta);
    return wrap;
  }

  function checkbox(label, checked, onChange) {
    const wrap = el('label', 'field-checkbox');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!checked;
    cb.onchange = () => onChange(cb.checked);
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(' ' + label));
    return wrap;
  }

  function colorField(label, value, onInput) {
    const wrap = el('div', 'field');
    wrap.appendChild(el('label', 'field-label', label));
    const inner = el('div', 'color-input');
    const text = document.createElement('input');
    text.type = 'text';
    text.value = value == null ? '' : String(value);
    text.placeholder = '#22c55e or any CSS color';
    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.value = isHex(text.value) ? text.value : '#888888';
    text.oninput = () => {
      onInput(text.value || undefined);
      if (isHex(text.value)) swatch.value = text.value;
    };
    swatch.oninput = () => {
      text.value = swatch.value;
      onInput(swatch.value);
    };
    inner.appendChild(text);
    inner.appendChild(swatch);
    wrap.appendChild(inner);
    return wrap;
  }

  function isHex(v) {
    return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
  }

  function renderIconPreview(icon) {
    const wrap = el('span', 'icon-preview');
    if (!icon || typeof icon !== 'string') {
      wrap.classList.add('icon-empty');
      wrap.textContent = '·';
      return wrap;
    }
    const trimmed = icon
      .trim()
      .replace(/^<\?xml[^?]*\?>\s*/i, '')
      .replace(/^<!DOCTYPE[^>]*>\s*/i, '');
    if (!trimmed) {
      wrap.classList.add('icon-empty');
      wrap.textContent = '·';
      return wrap;
    }
    if (/^<svg[\s>]/i.test(trimmed)) {
      wrap.innerHTML = trimmed;
      const svg = wrap.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.classList.add('icon-preview-svg');
      }
      return wrap;
    }
    if (/^(https?:|data:|\/|\.)/.test(trimmed)) {
      const img = document.createElement('img');
      img.src = trimmed;
      img.onerror = () => {
        wrap.innerHTML = '';
        wrap.classList.add('icon-empty');
        wrap.textContent = '?';
      };
      wrap.appendChild(img);
      return wrap;
    }
    wrap.textContent = trimmed;
    return wrap;
  }

  // === state mutators ===

  function updateButton(gi, bi, key, value) {
    const btn = state.groups[gi].buttons[bi];
    if (value === undefined || value === '' || value === false) {
      delete btn[key];
    } else {
      btn[key] = value;
    }
    markDirty();
  }

  function moveButtonInGroup(gi, bi, delta) {
    const g = state.groups[gi];
    const target = bi + delta;
    if (target < 0 || target >= g.buttons.length) return;
    const [moved] = g.buttons.splice(bi, 1);
    g.buttons.splice(target, 0, moved);
    markDirty();
    render();
  }

  function moveButtonToGroup(fromGi, fromBi, toGi) {
    if (fromGi === toGi) return;
    const [moved] = state.groups[fromGi].buttons.splice(fromBi, 1);
    state.groups[toGi].buttons.push(moved);
    markDirty();
    render();
  }

  function deleteButton(gi, bi) {
    const btn = state.groups[gi].buttons[bi];
    const label = btn && btn.title ? `"${btn.title}"` : 'this button';
    if (!confirm(`Delete ${label}?`)) return;
    state.groups[gi].buttons.splice(bi, 1);
    markDirty();
    render();
  }

  function duplicateButton(gi, bi) {
    const orig = state.groups[gi].buttons[bi];
    const copy = JSON.parse(JSON.stringify(orig));
    copy.title = (copy.title || 'Untitled') + ' (copy)';
    assignUid(copy);
    state.groups[gi].buttons.splice(bi + 1, 0, copy);
    expandedUid = copy.__uid;
    markDirty();
    render();
  }

  function addButton(gi) {
    const newBtn = { title: 'New button', commands: [] };
    assignUid(newBtn);
    state.groups[gi].buttons.push(newBtn);
    expandedUid = newBtn.__uid;
    markDirty();
    render();
  }

  function toggleExpand(uid) {
    expandedUid = expandedUid === uid ? -1 : uid;
    render();
  }

  function moveCategory(gi, delta) {
    if (gi < 1) return;
    const target = gi + delta;
    if (target < 1 || target >= state.groups.length) return;
    const [moved] = state.groups.splice(gi, 1);
    state.groups.splice(target, 0, moved);
    markDirty();
    render();
  }

  function deleteCategory(gi) {
    const g = state.groups[gi];
    if (g.buttons.length > 0) {
      const ok = confirm(
        `Delete category "${g.name}"? Its ${g.buttons.length} button(s) will move to Uncategorized.`,
      );
      if (!ok) return;
    }
    state.groups[0].buttons.push(...g.buttons);
    state.groups.splice(gi, 1);
    markDirty();
    render();
  }

  function addCategory() {
    const base = 'New category';
    let name = base;
    let n = 2;
    while (state.groups.some((g) => g.name === name)) {
      name = base + ' ' + n;
      n++;
    }
    state.groups.push({ name, buttons: [] });
    markDirty();
    render();
    // Focus + select the new category's name input so the user can type a name immediately.
    setTimeout(() => {
      const inputs = root.querySelectorAll('.group-name-input');
      const last = inputs[inputs.length - 1];
      if (last) {
        last.focus();
        last.select();
      }
    }, 0);
  }

  function renameCategory(gi, newName) {
    const trimmed = (newName || '').trim();
    const g = state.groups[gi];
    if (trimmed === g.name) return;
    if (!trimmed) {
      state.groups[0].buttons.push(...g.buttons);
      state.groups.splice(gi, 1);
      markDirty();
      render();
      return;
    }
    const dupe = state.groups.findIndex((og, idx) => og.name === trimmed && idx !== gi);
    if (dupe !== -1) {
      state.groups[dupe].buttons.push(...g.buttons);
      state.groups.splice(gi, 1);
      markDirty();
      render();
      return;
    }
    g.name = trimmed;
    markDirty();
    render();
  }

  function addStep(gi, bi, type) {
    const step =
      type === 'vscode'
        ? { type: 'vscode', command: '' }
        : { type: 'shell', command: '' };
    const btn = state.groups[gi].buttons[bi];
    if (!Array.isArray(btn.commands)) btn.commands = [];
    btn.commands.push(step);
    markDirty();
    render();
  }

  function deleteStep(gi, bi, sIdx) {
    state.groups[gi].buttons[bi].commands.splice(sIdx, 1);
    markDirty();
    render();
  }

  function moveStep(gi, bi, sIdx, delta) {
    const cmds = state.groups[gi].buttons[bi].commands;
    const target = sIdx + delta;
    if (target < 0 || target >= cmds.length) return;
    const [moved] = cmds.splice(sIdx, 1);
    cmds.splice(target, 0, moved);
    markDirty();
    render();
  }

  function changeStepType(gi, bi, sIdx, newType) {
    const old = state.groups[gi].buttons[bi].commands[sIdx];
    if (old.type === newType) return;
    state.groups[gi].buttons[bi].commands[sIdx] =
      newType === 'vscode'
        ? { type: 'vscode', command: old.command || '' }
        : { type: 'shell', command: old.command || '' };
    markDirty();
    render();
  }

  function updateStep(gi, bi, sIdx, key, value) {
    const step = state.groups[gi].buttons[bi].commands[sIdx];
    if (value === undefined || value === '' || value === false) {
      delete step[key];
    } else {
      step[key] = value;
    }
    markDirty();
  }

  // === drag-and-drop ===

  function clearDropIndicators() {
    document
      .querySelectorAll('.drop-before, .drop-after, .drop-into')
      .forEach((node) => {
        node.classList.remove('drop-before', 'drop-after', 'drop-into');
      });
  }

  function onHandleDragStart(e, uid, card) {
    dragUid = uid;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(uid));
    try {
      e.dataTransfer.setDragImage(card, 12, 12);
    } catch (_) {
      /* some browsers throw on setDragImage with detached nodes; ignore */
    }
    setTimeout(() => card.classList.add('dragging'), 0);
  }

  function onDragEnd(card) {
    card.classList.remove('dragging');
    clearDropIndicators();
    dragUid = -1;
  }

  function onCardDragOver(e, card, targetUid) {
    if (dragUid === -1 || targetUid === dragUid) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = card.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    clearDropIndicators();
    card.classList.add(before ? 'drop-before' : 'drop-after');
  }

  function onCardDrop(e, card, gi, bi) {
    if (dragUid === -1) return;
    e.preventDefault();
    e.stopPropagation();
    const before = card.classList.contains('drop-before');
    clearDropIndicators();
    performDrop(dragUid, gi, bi, before);
    dragUid = -1;
  }

  function onListDragOver(e, list, gi) {
    if (dragUid === -1) return;
    if (e.target.closest('.btn-card')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    list.classList.add('drop-into');
  }

  function onListDragLeave(e, list) {
    if (!list.contains(e.relatedTarget)) {
      list.classList.remove('drop-into');
    }
  }

  function onListDrop(e, list, gi) {
    if (dragUid === -1) return;
    if (e.target.closest('.btn-card')) return;
    e.preventDefault();
    e.stopPropagation();
    clearDropIndicators();
    performDrop(dragUid, gi, state.groups[gi].buttons.length, true);
    dragUid = -1;
  }

  function performDrop(uid, targetGi, targetBi, before) {
    const from = findByUid(uid);
    if (!from) return;
    let toGi = targetGi;
    let toBi = before ? targetBi : targetBi + 1;
    if (from.gi === toGi && from.bi < toBi) toBi -= 1;
    if (from.gi === toGi && from.bi === toBi) return;
    const [moved] = state.groups[from.gi].buttons.splice(from.bi, 1);
    state.groups[toGi].buttons.splice(toBi, 0, moved);
    markDirty();
    render();
  }

  // === render ===

  function renderHeader() {
    const header = el('div', 'editor-header');
    const title = el('div', 'editor-title');
    title.appendChild(el('span', 'title-main', 'Deck Editor'));
    const status = el('span', 'save-status');
    if (saveStatus === 'saving') {
      status.textContent = 'Saving…';
      status.classList.add('status-saving');
    } else if (saveStatus === 'saved') {
      status.textContent = 'Saved';
      status.classList.add('status-saved');
    } else if (dirty) {
      status.textContent = 'Unsaved changes';
      status.classList.add('status-dirty');
    } else {
      status.textContent = 'All changes saved';
    }
    title.appendChild(status);
    header.appendChild(title);

    const actions = el('div', 'editor-actions');
    actions.appendChild(
      iconBtn('Save', 'Save to deck.json', save, {
        primary: true,
        disabled: !dirty || saveStatus === 'saving',
      }),
    );
    actions.appendChild(
      iconBtn('Reload', 'Reload from file (discards unsaved changes)', reload),
    );
    actions.appendChild(
      iconBtn('Edit JSON', 'Open the raw deck.json file', () =>
        vscode.postMessage({ type: 'editJson' }),
      ),
    );
    header.appendChild(actions);
    return header;
  }

  function renderSettings() {
    const wrap = el('div', 'settings');
    wrap.appendChild(el('div', 'section-label', 'Display'));
    const row = el('div', 'settings-row');
    row.appendChild(
      selectField(
        'Mode',
        state.mode,
        [
          { value: 'sidebar', label: 'Sidebar' },
          { value: 'floating', label: 'Floating window' },
        ],
        (v) => {
          state.mode = v;
          markDirty();
        },
      ),
    );
    row.appendChild(
      numField(
        'Columns',
        state.columns,
        (n) => {
          if (n === undefined) state.columns = undefined;
          else if (n >= 1) state.columns = Math.floor(n);
          markDirty();
        },
        { min: 1, step: 1, placeholder: '4' },
      ),
    );
    row.appendChild(
      numField(
        'Icon size (px)',
        state.iconSize,
        (n) => {
          if (n === undefined) state.iconSize = undefined;
          else if (n > 0) state.iconSize = n;
          markDirty();
        },
        { min: 1, step: 1, placeholder: '28' },
      ),
    );
    wrap.appendChild(row);
    return wrap;
  }

  function renderListTop() {
    const top = el('div', 'btn-list-top');
    top.appendChild(el('div', 'section-label', 'Buttons (' + totalButtons() + ')'));
    const actions = el('div', 'btn-list-actions');
    actions.appendChild(iconBtn('+ New category', 'Add a new category', addCategory));
    actions.appendChild(
      iconBtn('Generate from workspace…', 'Auto-detect buttons', () => {
        if (
          totalButtons() > 0 &&
          !confirm('Replace existing buttons with auto-detected ones?')
        ) {
          return;
        }
        vscode.postMessage({ type: 'generateFromWorkspace' });
      }),
    );
    top.appendChild(actions);
    return top;
  }

  function renderGroup(group, gi) {
    const section = el('div', 'group-section');
    const isUnc = group.name === '';
    if (isUnc) section.classList.add('group-uncategorized');

    // header
    const header = el('div', 'group-header');
    if (isUnc) {
      header.appendChild(el('div', 'group-name group-name-uncat', 'Uncategorized'));
    } else {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'group-name-input';
      nameInput.value = group.name;
      nameInput.placeholder = 'Category name';
      nameInput.onchange = () => renameCategory(gi, nameInput.value);
      nameInput.onkeydown = (e) => {
        if (e.key === 'Enter') nameInput.blur();
      };
      header.appendChild(nameInput);
    }

    const tools = el('div', 'group-tools');
    const count = el('span', 'group-count', String(group.buttons.length));
    tools.appendChild(count);
    if (!isUnc) {
      tools.appendChild(
        iconBtn('▲', 'Move category up', () => moveCategory(gi, -1), {
          disabled: gi <= 1,
        }),
      );
      tools.appendChild(
        iconBtn('▼', 'Move category down', () => moveCategory(gi, 1), {
          disabled: gi >= state.groups.length - 1,
        }),
      );
      tools.appendChild(
        iconBtn('×', 'Delete category', () => deleteCategory(gi), { danger: true }),
      );
    }
    header.appendChild(tools);
    section.appendChild(header);

    // list (drop target for "drop at end")
    const list = el('div', 'group-list');
    list.dataset.groupIndex = String(gi);
    list.addEventListener('dragover', (e) => onListDragOver(e, list, gi));
    list.addEventListener('dragleave', (e) => onListDragLeave(e, list));
    list.addEventListener('drop', (e) => onListDrop(e, list, gi));

    if (group.buttons.length === 0) {
      list.appendChild(el('div', 'group-empty', 'Drop buttons here, or add a new one below.'));
    }
    group.buttons.forEach((btn, bi) => {
      list.appendChild(renderButtonRow(btn, gi, bi));
    });
    section.appendChild(list);

    // add bar
    const addBar = el('div', 'group-add');
    addBar.appendChild(
      iconBtn(
        '+ Add button',
        isUnc ? 'Add a new uncategorized button' : 'Add a button to "' + group.name + '"',
        () => addButton(gi),
        { primary: true },
      ),
    );
    section.appendChild(addBar);

    return section;
  }

  function renderButtonRow(btn, gi, bi) {
    const card = el('div', 'btn-card');
    const expanded = btn.__uid === expandedUid;
    if (expanded) card.classList.add('expanded');
    card.dataset.uid = String(btn.__uid);

    card.addEventListener('dragover', (e) => onCardDragOver(e, card, btn.__uid));
    card.addEventListener('drop', (e) => onCardDrop(e, card, gi, bi));

    const head = el('div', 'btn-head');

    const handle = el('span', 'btn-drag-handle');
    handle.draggable = true;
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.addEventListener('dragstart', (e) => onHandleDragStart(e, btn.__uid, card));
    handle.addEventListener('dragend', () => onDragEnd(card));
    head.appendChild(handle);

    const move = el('div', 'btn-move');
    move.appendChild(
      iconBtn('▲', 'Move up', () => moveButtonInGroup(gi, bi, -1), {
        disabled: bi === 0,
      }),
    );
    move.appendChild(
      iconBtn('▼', 'Move down', () => moveButtonInGroup(gi, bi, 1), {
        disabled: bi === state.groups[gi].buttons.length - 1,
      }),
    );
    head.appendChild(move);

    const summary = el('div', 'btn-summary');
    const swatch = el('span', 'btn-swatch');
    if (btn.color) swatch.style.background = btn.color;
    summary.appendChild(swatch);
    summary.appendChild(renderIconPreview(btn.icon));
    const labelWrap = el('div', 'btn-label');
    labelWrap.appendChild(el('span', 'btn-name', btn.title || '(untitled)'));
    const stepCount = (btn.commands || []).length;
    labelWrap.appendChild(
      el('span', 'btn-meta', stepCount + ' step' + (stepCount === 1 ? '' : 's')),
    );
    summary.appendChild(labelWrap);
    summary.onclick = () => toggleExpand(btn.__uid);
    head.appendChild(summary);

    const tools = el('div', 'btn-tools');
    tools.appendChild(
      iconBtn(expanded ? 'Done' : 'Edit', 'Edit', () => toggleExpand(btn.__uid)),
    );
    tools.appendChild(iconBtn('Duplicate', 'Duplicate', () => duplicateButton(gi, bi)));
    tools.appendChild(
      iconBtn('×', 'Delete', () => deleteButton(gi, bi), { danger: true }),
    );
    head.appendChild(tools);
    card.appendChild(head);

    if (expanded) {
      card.appendChild(renderButtonForm(btn, gi, bi));
    }
    return card;
  }

  function renderButtonForm(btn, gi, bi) {
    const form = el('div', 'btn-form');

    form.appendChild(
      field('Title', btn.title || '', (v) => {
        state.groups[gi].buttons[bi].title = v;
        const card = root.querySelector('.btn-card[data-uid="' + btn.__uid + '"]');
        const nameSpan = card && card.querySelector('.btn-name');
        if (nameSpan) nameSpan.textContent = v || '(untitled)';
        refreshSnippetFor(btn);
        markDirty();
      }),
    );

    // Icon with live preview
    const iconWrap = el('div', 'field');
    iconWrap.appendChild(el('label', 'field-label', 'Icon'));
    const iconCombo = el('div', 'icon-input');
    const iconInput = document.createElement('input');
    iconInput.type = 'text';
    iconInput.placeholder = 'emoji, URL, path, or <svg>…</svg>';
    iconInput.value = btn.icon || '';
    let livePreview = renderIconPreview(btn.icon);
    livePreview.classList.add('icon-preview-large');
    iconInput.oninput = () => {
      updateButton(gi, bi, 'icon', iconInput.value);
      const fresh = renderIconPreview(iconInput.value);
      fresh.classList.add('icon-preview-large');
      livePreview.replaceWith(fresh);
      livePreview = fresh;
    };
    iconCombo.appendChild(iconInput);
    iconCombo.appendChild(livePreview);
    iconWrap.appendChild(iconCombo);
    form.appendChild(iconWrap);

    form.appendChild(
      colorField('Color (top border)', btn.color || '', (v) =>
        updateButton(gi, bi, 'color', v),
      ),
    );

    // Move-to-category dropdown (keyboard-accessible alternative to drag)
    form.appendChild(
      selectField(
        'Category',
        String(gi),
        state.groups.map((g, idx) => ({
          value: String(idx),
          label: g.name || 'Uncategorized',
        })),
        (v) => moveButtonToGroup(gi, bi, parseInt(v, 10)),
      ),
    );

    form.appendChild(renderKeybindingSection(btn, gi, bi));

    // Commands
    const cmdsHeader = el('div', 'cmds-header');
    cmdsHeader.appendChild(el('div', 'section-label', 'Commands'));
    const addRow = el('div', 'cmds-add');
    addRow.appendChild(
      iconBtn('+ Shell', 'Add shell step', () => addStep(gi, bi, 'shell')),
    );
    addRow.appendChild(
      iconBtn('+ VSCode', 'Add VSCode command step', () => addStep(gi, bi, 'vscode')),
    );
    cmdsHeader.appendChild(addRow);
    form.appendChild(cmdsHeader);

    const stepList = el('div', 'step-list');
    const cmds = btn.commands || [];
    cmds.forEach((step, sIdx) => {
      stepList.appendChild(renderStep(gi, bi, sIdx, step, cmds.length));
    });
    if (cmds.length === 0) {
      stepList.appendChild(el('div', 'empty-hint', 'No steps yet. Add one above.'));
    }
    form.appendChild(stepList);

    return form;
  }

  function renderStep(gi, bi, sIdx, step, total) {
    const card = el('div', 'step-card');
    const top = el('div', 'step-top');

    const move = el('div', 'step-move');
    move.appendChild(
      iconBtn('▲', 'Move up', () => moveStep(gi, bi, sIdx, -1), {
        disabled: sIdx === 0,
      }),
    );
    move.appendChild(
      iconBtn('▼', 'Move down', () => moveStep(gi, bi, sIdx, 1), {
        disabled: sIdx === total - 1,
      }),
    );
    top.appendChild(move);
    top.appendChild(el('span', 'step-num', String(sIdx + 1)));
    top.appendChild(
      selectField(
        '',
        step.type,
        [
          { value: 'vscode', label: 'VSCode command' },
          { value: 'shell', label: 'Shell command' },
        ],
        (v) => changeStepType(gi, bi, sIdx, v),
      ),
    );
    top.appendChild(el('div', 'step-spacer'));
    top.appendChild(
      iconBtn('×', 'Delete step', () => deleteStep(gi, bi, sIdx), { danger: true }),
    );
    card.appendChild(top);

    const body = el('div', 'step-body');
    if (step.type === 'vscode') {
      body.appendChild(
        field(
          'Command ID',
          step.command || '',
          (v) => updateStep(gi, bi, sIdx, 'command', v),
          { placeholder: 'e.g. workbench.action.files.saveAll' },
        ),
      );
      body.appendChild(renderArgsField(gi, bi, sIdx, step.args));
    } else {
      body.appendChild(
        textareaField(
          'Command',
          step.command || '',
          (v) => updateStep(gi, bi, sIdx, 'command', v),
          { placeholder: 'e.g. npm run dev', rows: 2 },
        ),
      );
      body.appendChild(
        field(
          'Working directory (cwd)',
          step.cwd || '',
          (v) => updateStep(gi, bi, sIdx, 'cwd', v || undefined),
          { placeholder: '${workspaceFolder} or a relative path' },
        ),
      );
      body.appendChild(
        checkbox('Continue on error', !!step.continueOnError, (v) =>
          updateStep(gi, bi, sIdx, 'continueOnError', v),
        ),
      );
    }
    card.appendChild(body);
    return card;
  }

  function buttonKeybindingSnippet(btn) {
    const arg = btn && btn.id && btn.id.trim() ? btn.id.trim() : (btn && btn.title) || '';
    return (
      '{ "key": "ctrl+alt+", "command": "vscodeDeck.runButton", "args": ' +
      JSON.stringify(arg) +
      ' }'
    );
  }

  function refreshSnippetFor(btn) {
    if (!btn) return;
    const code = root.querySelector(
      '.btn-card[data-uid="' + btn.__uid + '"] .keybind-snippet code',
    );
    if (code) code.textContent = buttonKeybindingSnippet(btn);
  }

  function renderKeybindingSection(btn, gi, bi) {
    const wrap = el('div', 'keybind-section');
    wrap.appendChild(el('div', 'section-label', 'Keyboard shortcut'));

    const help = el('div', 'keybind-help');
    help.textContent =
      'Bind any key to this button via VSCode keybindings. Set an ID to make the binding survive title renames; otherwise it matches by title.';
    wrap.appendChild(help);

    wrap.appendChild(
      field(
        'ID (optional, stable)',
        btn.id || '',
        (v) => {
          const trimmed = (v || '').trim();
          updateButton(gi, bi, 'id', trimmed || undefined);
          refreshSnippetFor(btn);
        },
        { placeholder: 'e.g. build, deploy, test-watch' },
      ),
    );

    const snippetBox = el('div', 'keybind-snippet');
    const snippetPre = document.createElement('pre');
    snippetPre.className = 'keybind-snippet-pre';
    const snippetText = document.createElement('code');
    snippetText.textContent = buttonKeybindingSnippet(btn);
    snippetPre.appendChild(snippetText);
    snippetBox.appendChild(snippetPre);

    const snippetActions = el('div', 'keybind-actions');
    snippetActions.appendChild(
      iconBtn('Copy keybinding', 'Copy snippet to clipboard', () => {
        vscode.postMessage({
          type: 'copyToClipboard',
          text: snippetText.textContent,
          toast:
            'Deck: keybinding copied. Paste it into Keyboard Shortcuts (JSON) and set "key".',
        });
      }),
    );
    snippetActions.appendChild(
      iconBtn('Open Keyboard Shortcuts', 'Open the VSCode keybindings UI', () => {
        vscode.postMessage({ type: 'openKeybindings' });
      }),
    );
    snippetBox.appendChild(snippetActions);
    wrap.appendChild(snippetBox);

    return wrap;
  }

  function renderArgsField(gi, bi, sIdx, args) {
    const wrap = el('div', 'field');
    wrap.appendChild(el('label', 'field-label', 'Args (JSON array, optional)'));
    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.placeholder = '[]';
    ta.value = args === undefined ? '' : JSON.stringify(args);
    const err = el('div', 'field-err');
    ta.oninput = () => {
      const raw = ta.value.trim();
      if (raw === '') {
        updateStep(gi, bi, sIdx, 'args', undefined);
        err.textContent = '';
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          err.textContent = 'Must be a JSON array';
          return;
        }
        err.textContent = '';
        updateStep(gi, bi, sIdx, 'args', parsed);
      } catch (e) {
        err.textContent = 'Invalid JSON';
      }
    };
    wrap.appendChild(ta);
    wrap.appendChild(err);
    return wrap;
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(renderHeader());
    root.appendChild(renderSettings());

    const area = el('div', 'btn-list');
    area.appendChild(renderListTop());
    state.groups.forEach((g, gi) => area.appendChild(renderGroup(g, gi)));
    root.appendChild(area);
  }

  // === incoming messages ===

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'config') {
      setConfig(msg.config);
    } else if (msg.type === 'saved') {
      dirty = false;
      saveStatus = 'saved';
      renderHeaderOnly();
      setTimeout(() => {
        if (saveStatus === 'saved') {
          saveStatus = null;
          renderHeaderOnly();
        }
      }, 1500);
    } else if (msg.type === 'saveError') {
      saveStatus = null;
      renderHeaderOnly();
    }
  });

  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      save();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // boot
  loadFromConfig(window.__deckConfig || {});
  render();
})();

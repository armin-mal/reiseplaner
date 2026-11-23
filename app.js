(() => {
  const STORAGE_KEY = "iphone_travel_planner_v1";

  const TICKET_ICONS = {
    flight: "✈️",
    hotel: "🏨",
    car: "🚗",
    ticket: "🎫",
  };

  const DEFAULT_DAY_1 = `# Anreise & Altstadt

- [x] Reisepass & Boarding Pass
- [ ] Mietwagen abholen

## Nachmittag
**16:30** Spaziergang durch die Altstadt & La Seu

> Tipp: Unten auf **Bearbeiten** tippen, um Markdown zu schreiben – oder nach links wischen für Tag 2.`;

  const DEFAULT_TICKETS_DAY_1 = [
    { id: "t1", type: "flight", title: "Flug LH 1824", meta: "10:15 → 12:30", url: "" },
    { id: "t2", type: "hotel", title: "Hotel Palma", meta: "Check-in 15:00", url: "" },
  ];

  const DAY_TEMPLATE = `## Morgen
- [ ] Frühstück
- 

## Mittag
- 

## Abend
- `;

  const defaultState = () => ({
    tripName: "Mallorca 2026",
    daysCount: 5,
    startDate: "",
    activeDay: 0,
    days: [DEFAULT_DAY_1, "", "", "", ""],
    tickets: [DEFAULT_TICKETS_DAY_1, [], [], [], []],
  });

  let state = loadState();
  let isEditMode = false;
  let scrollRaf = null;
  let editingTicket = null; // { dayIndex, ticketId } | null
  let selectedTicketType = "flight";

  // DOM Elements
  const appHeader = document.getElementById("appHeader");
  const headerTopBar = document.getElementById("headerTopBar");
  const headerLeftBtn = document.getElementById("headerLeftBtn");
  const tripTitleEditBtn = document.getElementById("tripTitleEditBtn");
  const tripTitleText = document.getElementById("tripTitleText");
  const tripSubtitleText = document.getElementById("tripSubtitleText");

  const dayPills = document.getElementById("dayPills");
  const mdToolbar = document.getElementById("mdToolbar");
  const toolbarTicketBtn = document.getElementById("toolbarTicketBtn");
  const insertTemplateBtn = document.getElementById("insertTemplateBtn");
  const daysTrack = document.getElementById("daysTrack");
  const bottomBar = document.getElementById("bottomBar");
  const prevDayBtn = document.getElementById("prevDayBtn");
  const nextCtaBtn = document.getElementById("nextCtaBtn");
  const nextDayBtn = document.getElementById("nextDayBtn");

  // Ticket Modal Elements
  const ticketModal = document.getElementById("ticketModal");
  const ticketModalTitle = document.getElementById("ticketModalTitle");
  const closeTicketModalBtn = document.getElementById("closeTicketModalBtn");
  const ticketTypeChips = document.getElementById("ticketTypeChips");
  const inputTicketTitle = document.getElementById("inputTicketTitle");
  const inputTicketMeta = document.getElementById("inputTicketMeta");
  const inputTicketUrl = document.getElementById("inputTicketUrl");
  const deleteTicketBtn = document.getElementById("deleteTicketBtn");
  const saveTicketBtn = document.getElementById("saveTicketBtn");

  // Settings Modal Elements
  const settingsModal = document.getElementById("settingsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const inputTripName = document.getElementById("inputTripName");
  const inputDaysCount = document.getElementById("inputDaysCount");
  const inputStartDate = document.getElementById("inputStartDate");
  const inputEndDate = document.getElementById("inputEndDate");
  const startDateDisplay = document.getElementById("startDateDisplay");
  const endDateDisplay = document.getElementById("endDateDisplay");
  const clearDatesBtn = document.getElementById("clearDatesBtn");
  const decDaysBtn = document.getElementById("decDaysBtn");
  const incDaysBtn = document.getElementById("incDaysBtn");
  const exportMdBtn = document.getElementById("exportMdBtn");
  const resetTripBtn = document.getElementById("resetTripBtn");
  const toastEl = document.getElementById("toast");

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const count = clampDays(parsed.daysCount || 5);
      const days = Array.isArray(parsed.days) ? parsed.days.slice() : [];
      const tickets = Array.isArray(parsed.tickets) ? parsed.tickets.slice() : [];
      while (days.length < count) days.push("");
      while (tickets.length < count) tickets.push([]);
      return {
        tripName: typeof parsed.tripName === "string" && parsed.tripName.trim() ? parsed.tripName : "Mallorca 2026",
        daysCount: count,
        startDate: typeof parsed.startDate === "string" ? parsed.startDate : "",
        activeDay: Math.min(Math.max(0, parsed.activeDay || 0), count - 1),
        days,
        tickets: tickets.map((list) => (Array.isArray(list) ? list : [])),
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }

  function clampDays(n) {
    const num = parseInt(n, 10);
    if (Number.isNaN(num)) return 1;
    return Math.min(60, Math.max(1, num));
  }

  function parseIsoDate(iso) {
    if (!iso) return null;
    const parts = iso.split("-").map(Number);
    if (parts.length !== 3) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function toIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatDayDate(dayIndex, compact = false) {
    const start = parseIsoDate(state.startDate);
    if (!start) return "";
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIndex);
    if (compact) {
      return date.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
    }
    return date.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  }

  function formatTripRange() {
    if (!state.startDate) return `${state.daysCount} ${state.daysCount === 1 ? "Tag" : "Tage"}`;
    const parts = state.startDate.split("-").map(Number);
    if (parts.length !== 3) return `${state.daysCount} Tage`;
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const end = new Date(parts[0], parts[1] - 1, parts[2] + state.daysCount - 1);
    const fmt = (d) => d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
    return `${state.daysCount} Tage · ${fmt(start)} – ${fmt(end)}`;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
  }

  // Safe lightweight Markdown -> HTML renderer
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderInline(text) {
    let out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
    return out;
  }

  function renderEditorHtml(mdText) {
    const trimmedAll = (mdText || "").trim();
    if (!trimmedAll) return "";

    const lines = mdText.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let listType = null;

    function closeList() {
      if (listType) {
        html += listType === "ol" ? "</ol>" : "</ul>";
        listType = null;
      }
    }

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        return;
      }

      const hMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (hMatch) {
        closeList();
        const level = hMatch[1].length;
        html += `<h${level}>${renderInline(hMatch[2])}</h${level}>`;
        return;
      }

      if (trimmed.startsWith("> ")) {
        closeList();
        html += `<blockquote>${renderInline(trimmed.slice(2))}</blockquote>`;
        return;
      }

      const todoMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
      if (todoMatch) {
        closeList();
        const checked = todoMatch[1].toLowerCase() === "x";
        html += `<div class="editor-todo ${checked ? "checked" : ""}"><input type="checkbox" contenteditable="false" ${checked ? "checked" : ""} /><span class="editor-todo-text">${renderInline(todoMatch[2]) || "<br>"}</span></div>`;
        return;
      }

      const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          html += "<ul>";
        }
        html += `<li>${renderInline(ulMatch[1])}</li>`;
        return;
      }

      const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          html += "<ol>";
        }
        html += `<li>${renderInline(olMatch[1])}</li>`;
        return;
      }

      closeList();
      html += `<p>${renderInline(trimmed)}</p>`;
    });

    closeList();
    return html;
  }

  function inlineNodesToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\u00a0/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "";
    const inner = Array.from(node.childNodes).map(inlineNodesToMarkdown).join("");
    if (tag === "strong" || tag === "b") return inner ? `**${inner}**` : "";
    if (tag === "em" || tag === "i") return inner ? `*${inner}*` : "";
    if (tag === "code") return inner ? `\`${inner}\`` : "";
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      return href ? `[${inner}](${href})` : inner;
    }
    return inner;
  }

  function editorToMarkdown(editorEl) {
    const lines = [];
    Array.from(editorEl.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.replace(/\u00a0/g, " ").trim();
        if (t) lines.push(t);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();

      if (node.classList.contains("editor-todo")) {
        const cb = node.querySelector('input[type="checkbox"]');
        const textEl = node.querySelector(".editor-todo-text") || node;
        const text = inlineNodesToMarkdown(textEl).trim();
        lines.push(`- [${cb && cb.checked ? "x" : " "}] ${text}`);
        return;
      }

      if (tag === "h1") {
        const t = inlineNodesToMarkdown(node).trim();
        if (t) lines.push(`# ${t}`);
      } else if (tag === "h2") {
        const t = inlineNodesToMarkdown(node).trim();
        if (t) lines.push(`## ${t}`);
      } else if (tag === "h3") {
        const t = inlineNodesToMarkdown(node).trim();
        if (t) lines.push(`### ${t}`);
      } else if (tag === "blockquote") {
        const t = inlineNodesToMarkdown(node).trim();
        if (t) lines.push(`> ${t}`);
      } else if (tag === "ul") {
        Array.from(node.children).forEach((li) => {
          const t = inlineNodesToMarkdown(li).trim();
          if (t) lines.push(`- ${t}`);
        });
      } else if (tag === "ol") {
        Array.from(node.children).forEach((li, idx) => {
          const t = inlineNodesToMarkdown(li).trim();
          if (t) lines.push(`${idx + 1}. ${t}`);
        });
      } else if (tag === "hr") {
        lines.push("---");
      } else {
        const t = inlineNodesToMarkdown(node).trim();
        if (t) lines.push(t);
      }
    });
    return lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function renderMarkdown(mdText, dayIndex) {
    const lines = (mdText || "").replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let listType = null;

    function closeList() {
      if (listType) {
        html += listType === "ol" ? "</ol>" : "</ul>";
        listType = null;
      }
    }

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        return;
      }

      if (/^---+$/.test(trimmed)) {
        closeList();
        html += "<hr />";
        return;
      }

      const hMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (hMatch) {
        closeList();
        const level = hMatch[1].length;
        html += `<h${level}>${renderInline(hMatch[2])}</h${level}>`;
        return;
      }

      if (trimmed.startsWith("> ")) {
        closeList();
        html += `<blockquote>${renderInline(trimmed.slice(2))}</blockquote>`;
        return;
      }

      const todoMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
      if (todoMatch) {
        if (listType !== "todo") {
          closeList();
          listType = "todo";
          html += '<ul class="todo-list">';
        }
        const checked = todoMatch[1].toLowerCase() === "x";
        html += `<li class="todo-item ${checked ? "checked" : ""}" data-day="${dayIndex}" data-line="${lineIdx}">
          <input type="checkbox" ${checked ? "checked" : ""} aria-label="Aufgabe abhaken" />
          <span>${renderInline(todoMatch[2])}</span>
        </li>`;
        return;
      }

      const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          html += "<ul>";
        }
        html += `<li>${renderInline(ulMatch[1])}</li>`;
        return;
      }

      const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          html += "<ol>";
        }
        html += `<li>${renderInline(olMatch[1])}</li>`;
        return;
      }

      closeList();
      html += `<p>${renderInline(trimmed)}</p>`;
    });

    closeList();
    return html;
  }

  function renderHeader() {
    const titleEditIcon = tripTitleEditBtn.querySelector(".title-edit-icon");
    if (isEditMode) {
      appHeader.classList.add("has-topbar");
      headerTopBar.classList.remove("hidden");
      if (titleEditIcon) titleEditIcon.classList.add("hidden");
      tripTitleText.textContent = "Bearbeiten";
      tripSubtitleText.textContent = `Tag ${state.activeDay + 1} · ${state.tripName}`;
      dayPills.classList.add("hidden");
      mdToolbar.classList.remove("hidden");
      bottomBar.classList.remove("hidden");
    } else {
      appHeader.classList.remove("has-topbar");
      headerTopBar.classList.add("hidden");
      if (titleEditIcon) titleEditIcon.classList.remove("hidden");
      tripTitleText.textContent = state.tripName;
      tripSubtitleText.textContent = formatTripRange();
      dayPills.classList.remove("hidden");
      mdToolbar.classList.add("hidden");
      bottomBar.classList.remove("hidden");
    }
  }

  function renderAll() {
    renderHeader();
    renderDayPills();
    renderSlides();
    updateActiveUI(state.activeDay, false);
  }

  function renderDayPills() {
    dayPills.innerHTML = "";
    const hasDates = Boolean(state.startDate);
    for (let i = 0; i < state.daysCount; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-pill" + (hasDates ? " has-date" : "") + (i === state.activeDay ? " active" : "");
      btn.dataset.day = String(i);
      const dateStr = hasDates ? formatDayDate(i, true) : "";
      btn.innerHTML = `<span>Tag ${i + 1}</span>${dateStr ? `<span class="day-pill-date">${dateStr}</span>` : ""}`;
      btn.addEventListener("click", () => goToDay(i, true));
      dayPills.appendChild(btn);
    }
  }

  function buildTicketsSection(dayIndex) {
    const section = document.createElement("section");
    section.className = "tickets-section";

    const headerRow = document.createElement("div");
    headerRow.className = "section-header-row";
    headerRow.innerHTML = `<span class="section-label">Tickets & Buchungen</span>`;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-ticket-btn";
    addBtn.textContent = "+ Ticket";
    addBtn.addEventListener("click", () => openTicketModal(dayIndex, null));
    headerRow.appendChild(addBtn);
    section.appendChild(headerRow);

    const dayTickets = state.tickets[dayIndex] || [];
    if (dayTickets.length === 0) {
      const emptyHint = document.createElement("button");
      emptyHint.type = "button";
      emptyHint.className = "tickets-empty-hint";
      emptyHint.textContent = "Flug, Hotel oder Eintrittskarte für diesen Tag ablegen …";
      emptyHint.addEventListener("click", () => openTicketModal(dayIndex, null));
      section.appendChild(emptyHint);
    } else {
      const grid = document.createElement("div");
      grid.className = "tickets-grid";
      dayTickets.forEach((ticket) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "ticket-card";
        const icon = TICKET_ICONS[ticket.type] || "🎫";
        card.innerHTML = `
          <div class="ticket-card-top">
            <span class="ticket-icon">${icon}</span>
            ${ticket.url ? '<span class="ticket-link-dot">Link ↗</span>' : ""}
          </div>
          <div class="ticket-title">${escapeHtml(ticket.title)}</div>
          ${ticket.meta ? `<div class="ticket-meta">${escapeHtml(ticket.meta)}</div>` : ""}
        `;
        card.addEventListener("click", () => openTicketModal(dayIndex, ticket.id));
        grid.appendChild(card);
      });
      section.appendChild(grid);
    }

    return section;
  }

  function renderSlides() {
    daysTrack.innerHTML = "";
    for (let i = 0; i < state.daysCount; i++) {
      const slide = document.createElement("section");
      slide.className = "day-slide";
      slide.dataset.day = String(i);

      if (isEditMode) {
        const editor = document.createElement("div");
        editor.className = "rich-editor";
        editor.contentEditable = "true";
        editor.dataset.day = String(i);
        editor.dataset.placeholder = `Tag ${i + 1} planen...\n\nTippe oben auf H1, H2, Fett, Todo oder Liste – es wird direkt formatiert.`;
        editor.innerHTML = renderEditorHtml(state.days[i] || "");

        const syncEditorState = () => {
          if (editor.textContent.trim() === "" && !editor.querySelector("h1, h2, h3, ul, ol, .editor-todo")) {
            if (editor.innerHTML !== "") editor.innerHTML = "";
          }
          state.days[i] = editorToMarkdown(editor);
          saveState();
        };

        editor.addEventListener("blur", () => {
          if (editor.textContent.trim() === "" && !editor.querySelector(".editor-todo")) {
            editor.innerHTML = "";
          }
        });

        editor.addEventListener("input", syncEditorState);
        editor.addEventListener("change", (e) => {
          const cb = e.target.closest('.editor-todo input[type="checkbox"]');
          if (cb) {
            cb.closest(".editor-todo").classList.toggle("checked", cb.checked);
            syncEditorState();
          }
        });
        editor.addEventListener("keydown", (e) => {
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount) return;
          const anchor = sel.anchorNode;
          const todoRow = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest(".editor-todo");

          if (e.key === "Enter" && todoRow) {
            e.preventDefault();
            const textEl = todoRow.querySelector(".editor-todo-text");
            if (textEl && textEl.textContent.trim() === "") {
              const p = document.createElement("p");
              p.innerHTML = "<br>";
              todoRow.replaceWith(p);
              placeCaretAtStart(p);
            } else {
              const nextTodo = createTodoElement("");
              todoRow.after(nextTodo);
              placeCaretAtStart(nextTodo.querySelector(".editor-todo-text"));
            }
            syncEditorState();
            return;
          }

          if (e.key === " " && anchor && anchor.nodeType === Node.TEXT_NODE) {
            const textBefore = anchor.textContent.slice(0, sel.anchorOffset);
            const block = anchor.parentElement?.closest("p, div:not(.rich-editor):not(.editor-todo)");
            if (block && block.parentElement === editor && block.textContent === textBefore) {
              if (textBefore === "#") {
                e.preventDefault();
                block.textContent = "";
                document.execCommand("formatBlock", false, "H1");
                syncEditorState();
              } else if (textBefore === "##") {
                e.preventDefault();
                block.textContent = "";
                document.execCommand("formatBlock", false, "H2");
                syncEditorState();
              } else if (textBefore === "-") {
                e.preventDefault();
                block.textContent = "";
                document.execCommand("insertUnorderedList");
                syncEditorState();
              } else if (textBefore === "- [ ]") {
                e.preventDefault();
                const todo = createTodoElement("");
                block.replaceWith(todo);
                placeCaretAtStart(todo.querySelector(".editor-todo-text"));
                syncEditorState();
              }
            }
          }
        });

        slide.appendChild(editor);

        const dayTickets = state.tickets[i] || [];
        if (dayTickets.length > 0) {
          const strip = document.createElement("div");
          strip.className = "edit-tickets-strip";
          dayTickets.forEach((t) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "edit-ticket-chip";
            chip.textContent = `${TICKET_ICONS[t.type] || "🎫"} ${t.title}`;
            chip.addEventListener("click", () => openTicketModal(i, t.id));
            strip.appendChild(chip);
          });
          slide.appendChild(strip);
        }
      } else {
        const content = (state.days[i] || "").trim();
        if (!content) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.innerHTML = `<p>Noch kein Tagesplan für <strong>Tag ${i + 1}</strong>.</p>`;
          slide.appendChild(empty);
        } else {
          const preview = document.createElement("div");
          preview.className = "md-preview";
          preview.innerHTML = renderMarkdown(state.days[i], i);
          preview.addEventListener("click", handlePreviewClick);
          slide.appendChild(preview);
        }

        slide.appendChild(buildTicketsSection(i));
      }

      daysTrack.appendChild(slide);
    }
  }

  function handlePreviewClick(e) {
    const todoItem = e.target.closest(".todo-item");
    if (!todoItem) return;

    const dayIdx = Number(todoItem.dataset.day);
    const lineIdx = Number(todoItem.dataset.line);
    const lines = (state.days[dayIdx] || "").replace(/\r\n/g, "\n").split("\n");
    const line = lines[lineIdx];
    if (typeof line !== "string") return;

    if (/^(\s*[-*]\s+)\[ \](.*)$/.test(line)) {
      lines[lineIdx] = line.replace(/^(\s*[-*]\s+)\[ \](.*)$/, "$1[x]$2");
    } else if (/^(\s*[-*]\s+)\[[xX]\](.*)$/.test(line)) {
      lines[lineIdx] = line.replace(/^(\s*[-*]\s+)\[[xX]\](.*)$/, "$1[ ]$2");
    }

    state.days[dayIdx] = lines.join("\n");
    saveState();

    const preview = todoItem.closest(".md-preview");
    if (preview) {
      preview.innerHTML = renderMarkdown(state.days[dayIdx], dayIdx);
    }
  }

  function createTodoElement(text = "") {
    const row = document.createElement("div");
    row.className = "editor-todo";
    row.innerHTML = `<input type="checkbox" contenteditable="false" /><span class="editor-todo-text">${text ? escapeHtml(text) : "<br>"}</span>`;
    return row;
  }

  function placeCaretAtStart(el) {
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function setEditMode(edit, focusDayIndex = state.activeDay) {
    isEditMode = edit;
    renderAll();
    goToDay(focusDayIndex, false);
    if (isEditMode) {
      const editor = daysTrack.querySelector(`.rich-editor[data-day="${focusDayIndex}"]`);
      if (editor) setTimeout(() => editor.focus(), 60);
    }
  }

  let programmaticTarget = null;
  let programmaticTimer = null;

  function goToDay(index, smooth = true) {
    const target = Math.min(Math.max(0, index), state.daysCount - 1);
    state.activeDay = target;

    const width = daysTrack.clientWidth;
    if (width > 0) {
      if (smooth) {
        programmaticTarget = target;
        clearTimeout(programmaticTimer);
        programmaticTimer = setTimeout(() => {
          programmaticTarget = null;
        }, 800);
      } else {
        programmaticTarget = null;
      }
      daysTrack.scrollTo({
        left: target * width,
        behavior: smooth ? "smooth" : "auto",
      });
    }
    updateActiveUI(target, true);
    saveState();
  }

  function updateActiveUI(index, scrollPill = true) {
    const pills = dayPills.querySelectorAll(".day-pill");
    pills.forEach((p, idx) => {
      const active = idx === index;
      p.classList.toggle("active", active);
      if (active && scrollPill) {
        p.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });

    if (isEditMode) {
      tripSubtitleText.textContent = `Tag ${index + 1} · ${state.tripName}`;
    }

    prevDayBtn.disabled = index <= 0;
    nextDayBtn.disabled = index >= state.daysCount - 1;
    nextCtaBtn.textContent = isEditMode ? "Speichern" : "Bearbeiten";
    nextCtaBtn.classList.remove("secondary-cta");
  }

  // Horizontal swipe sync: never fight programmatic smooth-scroll or save synchronously mid-frame
  let swipeSettleTimer = null;
  function settleSwipeIndex() {
    const width = daysTrack.clientWidth;
    if (!width) return;
    const settled = Math.min(Math.max(0, Math.round(daysTrack.scrollLeft / width)), state.daysCount - 1);
    programmaticTarget = null;
    if (settled !== state.activeDay) {
      state.activeDay = settled;
      updateActiveUI(settled, true);
    }
    saveState();
  }

  daysTrack.addEventListener("scroll", () => {
    if (programmaticTarget !== null) return;
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const width = daysTrack.clientWidth;
      if (!width) return;
      const exact = daysTrack.scrollLeft / width;
      if (Math.abs(exact - state.activeDay) < 0.55) return;
      const newIndex = Math.round(exact);
      if (newIndex !== state.activeDay && newIndex >= 0 && newIndex < state.daysCount) {
        state.activeDay = newIndex;
        updateActiveUI(newIndex, false);
      }
    });
    clearTimeout(swipeSettleTimer);
    swipeSettleTimer = setTimeout(settleSwipeIndex, 120);
  }, { passive: true });

  if ("onscrollend" in window) {
    daysTrack.addEventListener("scrollend", () => {
      clearTimeout(swipeSettleTimer);
      settleSwipeIndex();
    }, { passive: true });
  }

  // Rich-Text Formatting Toolbar (keep keyboard open via mousedown preventDefault)
  function updateToolbarActiveState() {
    if (!isEditMode) return;
    const editor = daysTrack.querySelector(`.rich-editor[data-day="${state.activeDay}"]`);
    if (!editor) return;

    const sel = window.getSelection();
    const anchor = sel && sel.rangeCount ? sel.anchorNode : null;
    const el = anchor ? (anchor.nodeType === 1 ? anchor : anchor.parentElement) : null;
    const inH1 = Boolean(el && el.closest("h1"));
    const inH2 = Boolean(el && el.closest("h2"));
    const isBold = document.queryCommandState && document.queryCommandState("bold");
    const isList = document.queryCommandState && document.queryCommandState("insertUnorderedList");

    mdToolbar.querySelectorAll(".md-tool-btn[data-format]").forEach((btn) => {
      const fmt = btn.dataset.format;
      const active =
        (fmt === "h1" && inH1) ||
        (fmt === "h2" && inH2) ||
        (fmt === "bold" && isBold) ||
        (fmt === "ul" && isList);
      btn.classList.toggle("active", active);
    });
  }

  document.addEventListener("selectionchange", updateToolbarActiveState);

  mdToolbar.addEventListener("mousedown", (e) => {
    if (e.target.closest(".md-tool-btn")) {
      e.preventDefault();
    }
  });

  mdToolbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".md-tool-btn");
    if (!btn) return;
    if (btn.id === "toolbarTicketBtn") {
      openTicketModal(state.activeDay, null);
      return;
    }

    const editor = daysTrack.querySelector(`.rich-editor[data-day="${state.activeDay}"]`);
    if (!editor) return;
    editor.focus();

    if (btn.id === "insertTemplateBtn") {
      const existing = editorToMarkdown(editor);
      const nextMd = existing ? `${existing}\n\n${DAY_TEMPLATE}` : DAY_TEMPLATE;
      editor.innerHTML = renderEditorHtml(nextMd);
      state.days[state.activeDay] = editorToMarkdown(editor);
      saveState();
      return;
    }

    const fmt = btn.dataset.format;
    if (fmt === "h1" || fmt === "h2") {
      if (editor.innerHTML.trim() === "") {
        const h = document.createElement(fmt);
        h.innerHTML = "<br>";
        editor.appendChild(h);
        placeCaretAtStart(h);
      } else {
        const sel = window.getSelection();
        const anchor = sel && sel.rangeCount ? sel.anchorNode : null;
        let block = anchor
          ? (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest("h1, h2, h3, p, div:not(.rich-editor):not(.editor-todo), li")
          : null;

        if (!block || !editor.contains(block)) {
          if (anchor && anchor.nodeType === Node.TEXT_NODE && anchor.parentElement === editor) {
            const p = document.createElement("p");
            anchor.before(p);
            p.appendChild(anchor);
            block = p;
          }
        }

        if (block && editor.contains(block) && block.tagName.toLowerCase() !== "li") {
          const nextTag = block.tagName.toLowerCase() === fmt ? "p" : fmt;
          const replacement = document.createElement(nextTag);
          replacement.innerHTML = block.innerHTML || "<br>";
          block.replaceWith(replacement);
          const range = document.createRange();
          range.selectNodeContents(replacement);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          document.execCommand("formatBlock", false, fmt.toUpperCase());
        }
      }
    } else if (fmt === "bold") {
      document.execCommand("bold");
    } else if (fmt === "ul") {
      document.execCommand("insertUnorderedList");
    } else if (fmt === "todo") {
      const todo = createTodoElement("");
      const sel = window.getSelection();
      const anchor = sel && sel.rangeCount ? sel.anchorNode : null;
      const block = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest("p, h1, h2, h3, div:not(.rich-editor):not(.editor-todo)");
      if (block && block.parentElement === editor && block.textContent.trim() === "") {
        block.replaceWith(todo);
      } else {
        editor.appendChild(todo);
      }
      placeCaretAtStart(todo.querySelector(".editor-todo-text"));
    }

    state.days[state.activeDay] = editorToMarkdown(editor);
    saveState();
    updateToolbarActiveState();
  });

  // Header & Bottom Bar Controls
  headerLeftBtn.addEventListener("click", () => {
    if (isEditMode) {
      setEditMode(false, state.activeDay);
    }
  });

  tripTitleEditBtn.addEventListener("click", () => {
    if (!isEditMode) openSettingsModal();
  });

  prevDayBtn.addEventListener("click", () => goToDay(state.activeDay - 1, true));
  nextDayBtn.addEventListener("click", () => goToDay(state.activeDay + 1, true));
  nextCtaBtn.addEventListener("click", () => setEditMode(!isEditMode, state.activeDay));

  // Ticket Modal Logic
  function setTicketTypeUI(type) {
    selectedTicketType = type;
    ticketTypeChips.querySelectorAll(".type-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.type === type);
    });
  }

  ticketTypeChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".type-chip");
    if (!chip) return;
    setTicketTypeUI(chip.dataset.type);
  });

  function openTicketModal(dayIndex, ticketId) {
    const dayTickets = state.tickets[dayIndex] || [];
    const existing = ticketId ? dayTickets.find((t) => t.id === ticketId) : null;
    editingTicket = { dayIndex, ticketId: existing ? existing.id : null };

    if (existing) {
      ticketModalTitle.textContent = "Ticket bearbeiten";
      setTicketTypeUI(existing.type || "ticket");
      inputTicketTitle.value = existing.title || "";
      inputTicketMeta.value = existing.meta || "";
      inputTicketUrl.value = existing.url || "";
      deleteTicketBtn.classList.remove("hidden");
    } else {
      ticketModalTitle.textContent = `Ticket für Tag ${dayIndex + 1}`;
      setTicketTypeUI("flight");
      inputTicketTitle.value = "";
      inputTicketMeta.value = "";
      inputTicketUrl.value = "";
      deleteTicketBtn.classList.add("hidden");
    }

    ticketModal.classList.remove("hidden");
    setTimeout(() => inputTicketTitle.focus(), 80);
  }

  function closeTicketModal() {
    ticketModal.classList.add("hidden");
    editingTicket = null;
  }

  closeTicketModalBtn.addEventListener("click", closeTicketModal);
  ticketModal.addEventListener("click", (e) => {
    if (e.target === ticketModal) closeTicketModal();
  });

  saveTicketBtn.addEventListener("click", () => {
    if (!editingTicket) return;
    const title = inputTicketTitle.value.trim();
    if (!title) {
      showToast("Bitte einen Titel eingeben");
      inputTicketTitle.focus();
      return;
    }

    const { dayIndex, ticketId } = editingTicket;
    if (!Array.isArray(state.tickets[dayIndex])) state.tickets[dayIndex] = [];

    const payload = {
      id: ticketId || `t_${Date.now()}`,
      type: selectedTicketType,
      title,
      meta: inputTicketMeta.value.trim(),
      url: inputTicketUrl.value.trim(),
    };

    if (ticketId) {
      const idx = state.tickets[dayIndex].findIndex((t) => t.id === ticketId);
      if (idx !== -1) state.tickets[dayIndex][idx] = payload;
    } else {
      state.tickets[dayIndex].push(payload);
    }

    saveState();
    closeTicketModal();
    renderAll();
    goToDay(dayIndex, false);
    showToast("Ticket gespeichert");
  });

  deleteTicketBtn.addEventListener("click", () => {
    if (!editingTicket || !editingTicket.ticketId) return;
    const { dayIndex, ticketId } = editingTicket;
    state.tickets[dayIndex] = (state.tickets[dayIndex] || []).filter((t) => t.id !== ticketId);
    saveState();
    closeTicketModal();
    renderAll();
    goToDay(dayIndex, false);
    showToast("Ticket gelöscht");
  });

  // Settings Modal Logic
  function formatDisplayDate(iso, fallback) {
    const d = parseIsoDate(iso);
    if (!d) return fallback;
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
  }

  function syncDateDisplays() {
    const hasStart = Boolean(inputStartDate.value);
    const hasEnd = Boolean(inputEndDate.value);
    startDateDisplay.textContent = formatDisplayDate(inputStartDate.value, "Start wählen");
    startDateDisplay.classList.toggle("placeholder", !hasStart);
    endDateDisplay.textContent = formatDisplayDate(inputEndDate.value, "Ende wählen");
    endDateDisplay.classList.toggle("placeholder", !hasEnd);
    clearDatesBtn.classList.toggle("hidden", !(hasStart || hasEnd));
  }

  function syncEndDateFromCount() {
    const start = parseIsoDate(inputStartDate.value);
    const count = clampDays(inputDaysCount.value);
    if (start) {
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + count - 1);
      inputEndDate.value = toIsoDate(end);
    }
    syncDateDisplays();
  }

  function openSettingsModal() {
    inputTripName.value = state.tripName;
    inputDaysCount.value = String(state.daysCount);
    inputStartDate.value = state.startDate || "";
    inputEndDate.value = "";
    syncEndDateFromCount();
    settingsModal.classList.remove("hidden");
  }

  inputStartDate.addEventListener("change", () => {
    const start = parseIsoDate(inputStartDate.value);
    const end = parseIsoDate(inputEndDate.value);
    if (start && end && end >= start) {
      const diff = Math.round((end - start) / 86400000) + 1;
      inputDaysCount.value = String(clampDays(diff));
    } else if (start) {
      syncEndDateFromCount();
    }
    syncDateDisplays();
  });

  inputEndDate.addEventListener("change", () => {
    const end = parseIsoDate(inputEndDate.value);
    let start = parseIsoDate(inputStartDate.value);
    if (end && !start) {
      const count = clampDays(inputDaysCount.value);
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (count - 1));
      inputStartDate.value = toIsoDate(start);
    } else if (start && end) {
      if (end < start) {
        inputEndDate.value = inputStartDate.value;
        inputDaysCount.value = "1";
      } else {
        const diff = Math.round((end - start) / 86400000) + 1;
        inputDaysCount.value = String(clampDays(diff));
      }
    }
    syncDateDisplays();
  });

  clearDatesBtn.addEventListener("click", () => {
    inputStartDate.value = "";
    inputEndDate.value = "";
    syncDateDisplays();
  });

  function closeSettingsModal() {
    const newName = inputTripName.value.trim() || "Mallorca 2026";
    const newCount = clampDays(inputDaysCount.value);
    const newDate = inputStartDate.value;

    state.tripName = newName;
    state.daysCount = newCount;
    state.startDate = newDate;
    while (state.days.length < newCount) state.days.push("");
    while (state.tickets.length < newCount) state.tickets.push([]);
    if (state.activeDay >= newCount) state.activeDay = newCount - 1;

    saveState();
    settingsModal.classList.add("hidden");
    renderAll();
  }

  closeModalBtn.addEventListener("click", closeSettingsModal);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  decDaysBtn.addEventListener("click", () => {
    inputDaysCount.value = String(clampDays(Number(inputDaysCount.value) - 1));
    syncEndDateFromCount();
  });
  incDaysBtn.addEventListener("click", () => {
    inputDaysCount.value = String(clampDays(Number(inputDaysCount.value) + 1));
    syncEndDateFromCount();
  });
  inputDaysCount.addEventListener("change", () => {
    inputDaysCount.value = String(clampDays(inputDaysCount.value));
    syncEndDateFromCount();
  });

  exportMdBtn.addEventListener("click", async () => {
    const lines = [`# ${state.tripName}\n`];
    for (let i = 0; i < state.daysCount; i++) {
      const dateStr = formatDayDate(i);
      lines.push(`## Tag ${i + 1}${dateStr ? ` (${dateStr})` : ""}`);
      const dayTickets = state.tickets[i] || [];
      if (dayTickets.length > 0) {
        lines.push("**Tickets & Buchungen:**");
        dayTickets.forEach((t) => {
          lines.push(`- ${TICKET_ICONS[t.type] || "🎫"} ${t.title}${t.meta ? ` (${t.meta})` : ""}`);
        });
        lines.push("");
      }
      lines.push((state.days[i] || "_Keine Einträge_").trim());
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Reiseplan als Markdown kopiert");
    } catch {
      showToast("Kopieren nicht möglich");
    }
  });

  resetTripBtn.addEventListener("click", () => {
    if (confirm("Wirklich alle Tage, Tickets und Notizen zurücksetzen?")) {
      state = defaultState();
      saveState();
      settingsModal.classList.add("hidden");
      isEditMode = false;
      renderAll();
      showToast("Reiseplan zurückgesetzt");
    }
  });

  let lastTrackWidth = daysTrack.clientWidth;

  window.addEventListener("resize", () => {
    const newWidth = daysTrack.clientWidth;
    if (newWidth && newWidth !== lastTrackWidth) {
      lastTrackWidth = newWidth;
      goToDay(state.activeDay, false);
    }
  });

  renderAll();
})();

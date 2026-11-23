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
        const textarea = document.createElement("textarea");
        textarea.className = "md-editor";
        textarea.dataset.day = String(i);
        textarea.placeholder = `Tag ${i + 1} planen...\n\n# Überschrift\n- [ ] Todo\n- Programmpunkt\n**14:00** Treffpunkt`;
        textarea.value = state.days[i] || "";
        textarea.addEventListener("input", (e) => {
          state.days[i] = e.target.value;
          saveState();
        });
        slide.appendChild(textarea);

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

  function setEditMode(edit, focusDayIndex = state.activeDay) {
    isEditMode = edit;
    renderAll();
    goToDay(focusDayIndex, false);
    if (isEditMode) {
      const editor = daysTrack.querySelector(`textarea[data-day="${focusDayIndex}"]`);
      if (editor) setTimeout(() => editor.focus(), 60);
    }
  }

  function goToDay(index, smooth = true) {
    const target = Math.min(Math.max(0, index), state.daysCount - 1);
    state.activeDay = target;
    saveState();

    const width = daysTrack.clientWidth;
    if (width > 0) {
      daysTrack.scrollTo({
        left: target * width,
        behavior: smooth ? "smooth" : "auto",
      });
    }
    updateActiveUI(target, true);
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

  // Horizontal swipe sync: update active pill smoothly without fighting finger drag
  let pillScrollTimer = null;
  daysTrack.addEventListener("scroll", () => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const width = daysTrack.clientWidth;
      if (!width) return;
      const newIndex = Math.round(daysTrack.scrollLeft / width);
      if (newIndex !== state.activeDay && newIndex >= 0 && newIndex < state.daysCount) {
        state.activeDay = newIndex;
        saveState();
        updateActiveUI(newIndex, false);
        clearTimeout(pillScrollTimer);
        pillScrollTimer = setTimeout(() => {
          const activePill = dayPills.querySelector(`.day-pill[data-day="${state.activeDay}"]`);
          if (activePill) {
            activePill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
          }
        }, 120);
      }
    });
  }, { passive: true });

  // Markdown Toolbar
  mdToolbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".md-tool-btn");
    if (!btn) return;
    if (btn.id === "toolbarTicketBtn") {
      openTicketModal(state.activeDay, null);
      return;
    }

    const editor = daysTrack.querySelector(`textarea[data-day="${state.activeDay}"]`);
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    if (btn.id === "insertTemplateBtn") {
      const prefix = val && !val.endsWith("\n") ? "\n\n" : "";
      editor.setRangeText(prefix + DAY_TEMPLATE, end, end, "end");
    } else if (btn.dataset.wrap) {
      const wrap = btn.dataset.wrap;
      const selected = val.slice(start, end) || "Text";
      editor.setRangeText(wrap + selected + wrap, start, end, "select");
    } else if (btn.dataset.insert) {
      const ins = btn.dataset.insert;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      editor.setRangeText(ins, lineStart, lineStart, "end");
    }

    state.days[state.activeDay] = editor.value;
    saveState();
    editor.focus();
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

  // Lock app height to visualViewport only while iOS keyboard is open;
  // otherwise let .app-shell fill 100% down to the home indicator edge.
  function syncVisualViewport() {
    if (window.visualViewport) {
      const vvHeight = window.visualViewport.height;
      const keyboardOpen = window.innerHeight - vvHeight > 100;
      if (keyboardOpen) {
        document.documentElement.style.setProperty("--app-height", `${vvHeight}px`);
      } else {
        document.documentElement.style.removeProperty("--app-height");
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    }
    goToDay(state.activeDay, false);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewport);
    window.visualViewport.addEventListener("scroll", () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    });
    syncVisualViewport();
  }

  window.addEventListener("resize", () => goToDay(state.activeDay, false));

  renderAll();
})();

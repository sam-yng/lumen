// Lumen web-app UI kit — screen compositions. Registers components on window.
// Composes the design-system primitives from the compiled bundle.

const DS = window.LumenDesignSystem_d5dc26;
const { Button, IconButton, Input, Badge, Tag, Avatar } = DS;
const Icon = window.LIcon;
const { TAGS, FOLDERS, ITEMS, SEGMENTS, NOTE_BODY } = window.LumenKit;

const tagById = (id) => TAGS.find((t) => t.id === id);
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// ----------------------------------------------------------------- Wordmark
function Wordmark({ size = 15 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: size, letterSpacing: "-0.02em", color: "var(--text)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--accent)", boxShadow: "0 0 14px var(--accent-glow)" }} />
      Lumen
    </span>
  );
}

// ------------------------------------------------------------------ Sidebar
function NavRow({ icon, label, active, disabled, accent, onClick, badge }) {
  const [hover, setHover] = React.useState(false);
  const bg = active ? "var(--accent-soft)" : hover && !disabled ? "var(--surface-2)" : "transparent";
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={disabled ? `${label} — coming soon` : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", height: 30,
        padding: "0 8px", borderRadius: "var(--r)", border: "none", background: bg,
        color: active ? "var(--accent-text)" : "var(--text-2)", font: "var(--t-sm)",
        fontWeight: active ? 500 : 400, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, textAlign: "left",
      }}
    >
      <Icon n={icon} size={16} color={accent ? "var(--accent-text)" : "currentColor"} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={{ font: "var(--t-meta)", color: "var(--text-4)" }}>{badge}</span>}
    </button>
  );
}

function FolderTree({ folders, selected, expanded, onSelect, onToggle, depth = 0, parent = null }) {
  const children = folders.filter((f) => f.parent === parent);
  return children.map((f) => {
    const hasKids = folders.some((x) => x.parent === f.id);
    const isOpen = expanded.has(f.id);
    const isSel = selected === f.id;
    return (
      <div key={f.id}>
        <button
          onClick={() => { onSelect(f.id); if (hasKids) onToggle(f.id); }}
          style={{
            position: "relative", display: "flex", alignItems: "center", gap: 6,
            width: "100%", height: "var(--row-h)", paddingLeft: 8 + depth * 14, paddingRight: 8,
            borderRadius: "var(--r)", border: "none",
            background: isSel ? "var(--accent-soft)" : "transparent",
            color: isSel ? "var(--accent-text)" : "var(--text-2)",
            font: "var(--t-sm)", fontWeight: isSel ? 500 : 400, cursor: "pointer", textAlign: "left",
          }}
          onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--surface-2)"; }}
          onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
        >
          {isSel && <span style={{ position: "absolute", left: 0, top: 5, bottom: 5, width: 2, borderRadius: 999, background: "var(--accent)" }} />}
          <span style={{ width: 14, display: "inline-flex", opacity: hasKids ? 1 : 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
            <Icon n="ChevronRight" size={13} color="var(--text-4)" />
          </span>
          <Icon n="Folder" size={15} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
        </button>
        {hasKids && isOpen && (
          <FolderTree folders={folders} selected={selected} expanded={expanded} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} parent={f.id} />
        )}
      </div>
    );
  });
}

function Sidebar({ view, selectedFolder, selectedTag, expanded, onSelectFolder, onToggleFolder, onSelectTag, onNewNote, onGo, onSignOut }) {
  return (
    <aside style={{ width: "var(--sidebar-w)", flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--surface)", borderRight: "1px solid var(--border-soft)", height: "100%" }}>
      <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Wordmark />
          <IconButton size="sm" title="Settings"><Icon n="Settings" size={15} /></IconButton>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
          <Button size="sm" onClick={onNewNote} iconStart={<Icon n="Plus" size={14} />}>New note</Button>
          <IconButton variant="outline" size="sm" title="Search"><Icon n="Search" size={14} /></IconButton>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 14 }}>
          <NavRow icon="Library" label="Library" active={view === "library"} onClick={() => onGo("library")} />
          <NavRow icon="Clock" label="Recents" disabled />
          <NavRow icon="Tag" label="Tags" onClick={() => onGo("library")} />
          <NavRow icon="Sparkles" label="Ask Lumen" accent disabled badge="soon" />
        </nav>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 4px", padding: "0 8px" }}>
          <span style={{ font: "var(--t-meta)", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Library</span>
          <IconButton size="sm" title="New folder"><Icon n="FolderPlus" size={14} /></IconButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FolderTree folders={FOLDERS} selected={selectedFolder} expanded={expanded} onSelect={onSelectFolder} onToggle={onToggleFolder} />
        </div>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
          <span style={{ font: "var(--t-meta)", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em", padding: "0 8px" }}>Tags</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, padding: "0 4px" }}>
            {TAGS.map((t) => (
              <Tag key={t.id} color={t.color} onClick={() => onSelectTag(selectedTag === t.id ? null : t.id)}
                style={selectedTag === t.id ? { borderColor: "var(--accent-line)", background: "var(--accent-soft)", color: "var(--accent-text)" } : undefined}>
                {t.name}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: 10, borderTop: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 9 }}>
        <Avatar name="S" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, font: "var(--t-sm)", fontWeight: 500, color: "var(--text)" }}>Workspace</p>
          <p style={{ margin: 0, font: "var(--t-meta)", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>sam@university.edu</p>
        </div>
        <IconButton size="sm" title="Log out" onClick={onSignOut}><Icon n="LogOut" size={15} /></IconButton>
      </div>
    </aside>
  );
}

// --------------------------------------------------------------- ItemRow
function ItemRow({ item, onOpen }) {
  const [hover, setHover] = React.useState(false);
  const tags = (item.tags || []).map(tagById).filter(Boolean);
  const iconName = item.type === "folder" ? "Folder" : item.type === "document" ? "FileText" : item.type === "recording" ? "Mic" : "File";
  const tileStyle = item.type === "recording"
    ? { background: "var(--busy-soft)", color: "var(--busy)", borderColor: "transparent" }
    : item.type === "folder"
    ? { background: "var(--accent-soft)", color: "var(--accent-text)", borderColor: "transparent" }
    : { background: "var(--surface-2)", color: "var(--text-2)", borderColor: "var(--border-soft)" };
  const tone = { done: "ok", processing: "busy", queued: "warn", failed: "danger" }[item.status];
  return (
    <li
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--border-soft)" }}
    >
      <button onClick={() => onOpen(item)} style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", padding: 0 }}>
        <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "var(--r)", border: "1px solid", flexShrink: 0, ...tileStyle }}>
          <Icon n={iconName} size={16} color="currentColor" />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", font: "var(--t-sm)", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
          <span style={{ display: "block", font: "var(--t-meta)", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.meta}</span>
        </span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {tags.map((t) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}
        {item.status && <Badge tone={tone} dot={item.status === "processing"}>{item.status === "done" ? "done" : item.status === "processing" ? "transcribing" : item.status}</Badge>}
        <span style={{ opacity: hover ? 1 : 0, transition: "opacity .12s" }}>
          <IconButton size="sm" title="Actions"><Icon n="MoreHorizontal" size={15} /></IconButton>
        </span>
      </div>
    </li>
  );
}

// ------------------------------------------------------------- LibraryView
function FilterChips({ selectedTag, onSelectTag }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ font: "var(--t-meta)", color: "var(--text-3)", textTransform: "uppercase", marginRight: 2 }}>Filter</span>
      {[{ id: null, name: "All" }, ...TAGS].map((t) => {
        const sel = selectedTag === t.id;
        return (
          <button key={t.id || "all"} onClick={() => onSelectTag(t.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 11px",
              borderRadius: 999, border: "1px solid", cursor: "pointer", font: "var(--t-xs)",
              borderColor: sel ? "var(--accent-line)" : "var(--border)",
              background: sel ? "var(--accent-soft)" : "var(--canvas)",
              color: sel ? "var(--accent-text)" : "var(--text-2)",
            }}>
            {t.color && <span style={{ width: 7, height: 7, borderRadius: 999, background: t.color }} />}
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

function LibraryView({ items, folders, folderName, selectedFolder, selectedTag, onSelectTag, onOpen }) {
  const childFolders = selectedTag ? [] : folders.filter((f) => f.parent === selectedFolder);
  let docs = items.filter((i) => i.folder === selectedFolder && i.type !== "folder");
  if (selectedTag) docs = docs.filter((i) => (i.tags || []).includes(selectedTag));
  const count = childFolders.length + docs.length;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 28px 60px" }}>
      <h1 style={{ font: "var(--t-h1)", margin: "0 0 2px", color: "var(--text)" }}>{folderName}</h1>
      <p style={{ font: "var(--t-meta)", color: "var(--text-3)", margin: "0 0 14px" }}>
        {selectedTag ? `Filtered by ${tagById(selectedTag).name}` : `${count} item${count === 1 ? "" : "s"}`}
      </p>
      <div style={{ marginBottom: 22 }}><FilterChips selectedTag={selectedTag} onSelectTag={onSelectTag} /></div>

      {childFolders.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ font: "var(--t-meta)", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 6px" }}>Folders</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: "0 12px", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", background: "var(--canvas)" }}>
            {childFolders.map((f) => <ItemRow key={f.id} item={{ ...f, type: "folder", title: f.name, meta: "Folder" }} onOpen={() => onOpen({ type: "folder", id: f.id })} />)}
          </ul>
        </section>
      )}

      {docs.length > 0 ? (
        <section>
          <h3 style={{ font: "var(--t-meta)", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 6px" }}>Notes &amp; files</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: "0 12px", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", background: "var(--canvas)" }}>
            {docs.map((i) => <ItemRow key={i.id} item={i} onOpen={onOpen} />)}
          </ul>
        </section>
      ) : childFolders.length === 0 && (
        <div style={{ display: "grid", placeItems: "center", minHeight: 280, border: "1px dashed var(--border-strong)", borderRadius: "var(--r-lg)", textAlign: "center", padding: 32 }}>
          <div style={{ maxWidth: 320 }}>
            <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, margin: "0 auto", borderRadius: "var(--r-lg)", background: "var(--accent-soft)", color: "var(--accent-text)" }}><Icon n="FileText" size={20} /></span>
            <h3 style={{ margin: "14px 0 4px", font: "var(--t-h2)" }}>Nothing here yet</h3>
            <p style={{ margin: 0, font: "var(--t-sm)", color: "var(--text-3)" }}>Create a note, upload a file, or record audio in this folder.</p>
          </div>
        </div>
      )}
    </div>
  );
}

window.LumenScreens = { Sidebar, LibraryView, Wordmark, fmt };

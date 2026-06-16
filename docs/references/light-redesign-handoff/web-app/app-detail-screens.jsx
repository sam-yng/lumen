// Lumen web-app UI kit — detail screens: note editor, transcript viewer, auth.

const DS2 = window.LumenDesignSystem_d5dc26;
const { Button: Btn, IconButton: IconBtn, Input: TextInput, Badge: StatusBadge, Tag: TagPill, Avatar: Av } = DS2;
const LI = window.LIcon;
const { SEGMENTS: SEG, NOTE_BODY: BODY } = window.LumenKit;
const fmtTime = window.LumenScreens.fmt;

// ----------------------------------------------------------------- Editor
function ToolDivider() {
  return <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />;
}
function ToolBtn({ icon, active, title }) {
  const [h, setH] = React.useState(false);
  return (
    <button title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "grid", placeItems: "center", width: 28, height: 26, borderRadius: "var(--r)", border: "none",
        background: active ? "var(--accent-soft)" : h ? "var(--surface-2)" : "transparent",
        color: active ? "var(--accent-text)" : "var(--text-2)", cursor: "pointer" }}>
      <LI n={icon} size={15} color="currentColor" />
    </button>
  );
}

function NoteEditor({ title, onClose }) {
  const blocks = BODY[title] || BODY["Cellular respiration"];
  return (
    <section style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
      <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", background: "var(--canvas)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, padding: "0 14px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, font: "var(--t-meta)", color: "var(--text-3)" }}>Library / Biology 101</p>
            <h3 style={{ margin: 0, font: "var(--t-h2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--t-meta)", color: "var(--text-3)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--ok)" }} />Saved
            </span>
            <Btn variant="outline" size="sm" onClick={onClose}>Close</Btn>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, minHeight: 40, borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
          <ToolBtn icon="Bold" title="Bold" /><ToolBtn icon="Italic" title="Italic" />
          <ToolDivider />
          <ToolBtn icon="Heading2" title="Heading" /><ToolBtn icon="List" title="Bullet list" /><ToolBtn icon="ListChecks" title="Task list" />
          <ToolDivider />
          <ToolBtn icon="Link" title="Link" /><ToolBtn icon="Table" title="Table" />
        </div>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 48px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <TagPill color="#2f9e6e">biology</TagPill><TagPill color="#7c5cff">midterm</TagPill>
            <span className="l-chip" style={{ borderStyle: "dashed", color: "var(--text-3)" }}>+ Tag</span>
          </div>
          <p style={{ font: "var(--t-meta)", color: "var(--text-3)", margin: "0 0 22px" }}>Updated 2d ago · 96 words · in Biology 101</p>
          <div className="lumen-editor">
            {blocks.map((b, i) => {
              if (b.tag === "h1") return <h1 key={i}>{b.text}</h1>;
              if (b.tag === "h2") return <h2 key={i}>{b.text}</h2>;
              if (b.tag === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
              if (b.tag === "quote") return <blockquote key={i}>{b.text}</blockquote>;
              return <p key={i}>{b.text}</p>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- Transcript
const BARS = Array.from({ length: 130 }, (_, i) => Math.round(28 + Math.abs(Math.sin(i * 0.4) * 0.5 + Math.sin(i * 0.13) * 0.3) * 60 + (i % 5) * 2));
const DURATION = 80000;

function TranscriptViewer({ title, onClose }) {
  const [time, setTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [rate, setRate] = React.useState(1);
  const RATES = [1, 1.25, 1.5, 1.75, 2];
  const listRef = React.useRef(null);
  const activeRef = React.useRef(null);

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTime((t) => (t >= DURATION ? (setPlaying(false), DURATION) : t + 200 * rate)), 200);
    return () => clearInterval(id);
  }, [playing, rate]);

  const activeIdx = SEG.reduce((acc, s, i) => (s.t <= time ? i : acc), -1);
  React.useEffect(() => {
    if (activeRef.current && listRef.current) {
      const c = listRef.current, el = activeRef.current;
      c.scrollTo({ top: Math.max(0, el.offsetTop - c.clientHeight * 0.4), behavior: "smooth" });
    }
  }, [activeIdx]);
  const progress = time / DURATION;

  return (
    <section style={{ maxWidth: 880, margin: "0 auto", width: "100%", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", background: "var(--canvas)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "var(--r)", background: "var(--busy-soft)", color: "var(--busy)", flexShrink: 0 }}><LI n="Mic" size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, font: "var(--t-h2)", fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
            <p style={{ margin: 0, font: "var(--t-meta)", color: "var(--text-3)" }}>12:04 · 2.4 MB · en · base.en</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusBadge tone="ok">done</StatusBadge>
          <Btn variant="outline" size="sm" onClick={onClose}>Close</Btn>
        </div>
      </header>

      <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 12, padding: 12, borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
        <button onClick={() => setPlaying((p) => !p)} title={playing ? "Pause" : "Play"}
          style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 999, border: "none", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer", boxShadow: "var(--shadow-accent)", flexShrink: 0 }}>
          <LI n={playing ? "Pause" : "Play"} size={16} color="currentColor" />
        </button>
        <button aria-label="Seek" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTime(((e.clientX - r.left) / r.width) * DURATION); }}
          style={{ position: "relative", display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0, height: 48, padding: "0 8px", borderRadius: "var(--r)", border: "1px solid var(--border-soft)", background: "var(--surface-2)", cursor: "pointer", overflow: "hidden" }}>
          {BARS.map((h, i) => (
            <span key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 999, background: i / BARS.length <= progress ? "var(--accent)" : "var(--border-strong)" }} />
          ))}
          <span style={{ position: "absolute", top: 4, bottom: 4, width: 1.5, borderRadius: 999, background: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)", left: `${progress * 100}%` }} />
        </button>
        <span style={{ font: "var(--t-meta)", color: "var(--text-3)", width: 86, textAlign: "right", flexShrink: 0 }}>{fmtTime(time)} / {fmtTime(DURATION)}</span>
        <Btn variant="outline" size="sm" onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}>{rate}x</Btn>
      </div>

      <ol ref={listRef} style={{ listStyle: "none", margin: 0, maxWidth: 720, marginInline: "auto", maxHeight: "52vh", overflowY: "auto", padding: 16 }}>
        {SEG.map((s, i) => {
          const active = i === activeIdx;
          return (
            <li key={i} ref={active ? activeRef : null}>
              <button onClick={() => setTime(s.t)}
                style={{ display: "grid", gridTemplateColumns: "54px 1fr", gap: 12, width: "100%", textAlign: "left", border: "none", borderLeft: "2px solid", borderColor: active ? "var(--accent)" : "transparent", borderRadius: "var(--r)", background: active ? "var(--accent-soft)" : "transparent", padding: "8px 10px", cursor: "pointer", marginBottom: 2 }}>
                <span style={{ font: "var(--t-meta)", color: active ? "var(--accent-text)" : "var(--text-3)", paddingTop: 3 }}>{fmtTime(s.t)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", font: "var(--t-meta)", fontSize: 10, textTransform: "uppercase", color: "var(--text-4)", marginBottom: 2 }}>{s.sp}</span>
                  <span style={{ fontFamily: "var(--font-read)", fontSize: 16, lineHeight: 1.6, color: "var(--text)" }}>{s.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------- Auth
function AuthScreen({ onSignIn }) {
  const features = [
    ["Library", "One nested library for the whole course"],
    ["Mic", "Local & live lecture transcription"],
    ["Search", "Hybrid search over notes and transcripts"],
    ["Sparkles", "A Claude-key assistant over your own vault"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", minHeight: "100vh", background: "var(--canvas)" }}>
      <div style={{ position: "relative", overflow: "hidden", borderRight: "1px solid var(--border-soft)", background: "var(--surface)", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: -120, left: -80, width: 420, height: 420, borderRadius: 999, background: "radial-gradient(circle, var(--accent-glow), transparent 68%)", filter: "blur(20px)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <window.LumenScreens.Wordmark size={17} />
          <h1 style={{ fontFamily: "var(--font-read)", fontSize: 38, lineHeight: 1.15, fontWeight: 600, margin: "26px 0 14px", color: "var(--text)", maxWidth: 460 }}>Turn lectures into a searchable study system.</h1>
          <p style={{ font: "var(--t-body)", color: "var(--text-2)", maxWidth: 420, margin: "0 0 30px" }}>Capture notes, files, and recordings in one private workspace — transcribe locally or live, and search across everything.</p>
          <div style={{ display: "grid", gap: 14, maxWidth: 380 }}>
            {features.map(([ic, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "var(--r)", background: "var(--accent-soft)", color: "var(--accent-text)", flexShrink: 0 }}><LI n={ic} size={15} /></span>
                <span style={{ font: "var(--t-sm)", color: "var(--text)" }}>{label}</span>
              </div>
            ))}
          </div>
          <p style={{ font: "var(--t-meta)", color: "var(--text-4)", marginTop: 34 }}>Private by default · your recordings never leave your machine</p>
        </div>
      </div>
      <div style={{ display: "grid", placeItems: "center", padding: 28 }}>
        <div style={{ width: "100%", maxWidth: 340, border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", background: "var(--canvas)", boxShadow: "var(--shadow-pop)", padding: 26 }}>
          <h2 style={{ margin: "0 0 4px", font: "var(--t-h1)", fontSize: 22 }}>Log in</h2>
          <p style={{ margin: "0 0 20px", font: "var(--t-sm)", color: "var(--text-2)" }}>Welcome back to Lumen.</p>
          <Btn variant="outline" className="lui-btn" style={{ width: "100%", marginBottom: 14 }}>Continue with Google</Btn>
          <div style={{ display: "flex", alignItems: "center", gap: 10, font: "var(--t-meta)", color: "var(--text-4)", margin: "0 0 14px" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />or<span style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
          </div>
          <label style={{ display: "block", font: "var(--t-meta)", color: "var(--text-2)", marginBottom: 6 }}>Email</label>
          <div style={{ marginBottom: 12 }}><TextInput type="email" placeholder="you@university.edu" defaultValue="sam@university.edu" /></div>
          <label style={{ display: "block", font: "var(--t-meta)", color: "var(--text-2)", marginBottom: 6 }}>Password</label>
          <div style={{ marginBottom: 18 }}><TextInput type="password" defaultValue="········" /></div>
          <Btn style={{ width: "100%" }} onClick={onSignIn}>Log in</Btn>
          <p style={{ font: "var(--t-sm)", color: "var(--text-3)", marginTop: 16, marginBottom: 0 }}>Need an account? <a href="#" onClick={(e) => { e.preventDefault(); onSignIn(); }} style={{ color: "var(--accent-text)", fontWeight: 500 }}>Sign up</a></p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window.LumenScreens, { NoteEditor, TranscriptViewer, AuthScreen });

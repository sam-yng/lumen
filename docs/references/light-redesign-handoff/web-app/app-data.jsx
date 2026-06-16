// Lumen web-app UI kit — fake data + helpers. Registers globals for index.html.
// Filenames here are lowercase on purpose so the DS compiler does not treat
// them as bundled components.

const TAGS = [
  { id: "t1", name: "midterm", color: "#7c5cff" },
  { id: "t2", name: "biology", color: "#2f9e6e" },
  { id: "t3", name: "lecture", color: "#3a7bd5" },
  { id: "t4", name: "essay", color: "#d98a2b" },
];

const FOLDERS = [
  { id: "f1", name: "Biology 101", parent: null },
  { id: "f2", name: "Week 08", parent: "f1" },
  { id: "f3", name: "Lecture recordings", parent: null },
  { id: "f4", name: "Essay drafts", parent: null },
  { id: "f5", name: "Exam prep", parent: null },
];

// type: document | recording | file
const ITEMS = [
  { id: "n1", type: "document", folder: "f1", title: "Cellular respiration", meta: "Rich-text note · updated 2d ago", tags: ["t2", "t1"] },
  { id: "n2", type: "document", folder: "f1", title: "Glycolysis summary", meta: "Rich-text note · updated 5d ago", tags: ["t2"] },
  { id: "r1", type: "recording", folder: "f1", title: "week-08.m4a", meta: "12:04 · 2.4 MB · base.en", status: "done", tags: ["t3"] },
  { id: "r2", type: "recording", folder: "f1", title: "seminar-genetics.m4a", meta: "28:51 · 5.1 MB", status: "processing", tags: ["t3"] },
  { id: "n3", type: "document", folder: "f4", title: "Midterm study guide", meta: "Rich-text note · updated 1d ago", tags: ["t1", "t4"] },
  { id: "r3", type: "recording", folder: "f3", title: "guest-lecture.m4a", meta: "44:10 · 8.0 MB", status: "queued", tags: [] },
  { id: "x1", type: "file", folder: "f4", title: "rubric.pdf", meta: "application/pdf · 184 KB", tags: ["t4"] },
];

// Transcript segments for the "done" recording (week-08.m4a)
const SEGMENTS = [
  { t: 0, sp: "Lecturer", text: "Okay, let's pick up where we left off — cellular respiration." },
  { t: 7000, sp: "Lecturer", text: "So the mitochondrion is where respiration actually happens. That's the key takeaway for the exam." },
  { t: 16000, sp: "Lecturer", text: "Note the inner membrane folds, called cristae, which dramatically increase the surface area available." },
  { t: 26000, sp: "Student", text: "Is that the same as the matrix, or is the matrix the inside space?" },
  { t: 31000, sp: "Lecturer", text: "Good question — the matrix is the fluid-filled interior. The cristae are the folded membrane around it." },
  { t: 42000, sp: "Lecturer", text: "We break it into three stages: glycolysis, the citric acid cycle, and the electron transport chain." },
  { t: 54000, sp: "Lecturer", text: "Glycolysis happens in the cytoplasm and yields a net of two ATP per glucose molecule." },
  { t: 66000, sp: "Lecturer", text: "The electron transport chain is where the bulk of the ATP — around thirty-four — is generated." },
];

const NOTE_BODY = {
  "Cellular respiration": [
    { tag: "h1", text: "Cellular respiration" },
    { tag: "p", text: "Cellular respiration is the set of metabolic reactions that convert biochemical energy from nutrients into ATP, releasing waste products." },
    { tag: "h2", text: "Three stages" },
    { tag: "ul", items: ["Glycolysis — in the cytoplasm, nets 2 ATP", "Citric acid cycle — in the mitochondrial matrix", "Electron transport chain — across the inner membrane"] },
    { tag: "p", text: "The inner membrane folds (cristae) increase surface area, which is why most ATP is produced in the final stage." },
    { tag: "quote", text: "Exam tip: respiration happens in the mitochondrion — know the role of the cristae." },
  ],
};

window.LumenKit = { TAGS, FOLDERS, ITEMS, SEGMENTS, NOTE_BODY };

// Lucide icon helper as a React component.
window.LIcon = function LIcon({ n, size = 16, color = "currentColor", strokeWidth = 1.75, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || !window.lucide || !window.lucide[n]) return;
    node.innerHTML = "";
    const svg = window.lucide.createElement(window.lucide[n]);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("stroke-width", strokeWidth);
    node.appendChild(svg);
  }, [n, size, strokeWidth]);
  return React.createElement("span", { ref, style: { display: "inline-flex", color, ...style } });
};

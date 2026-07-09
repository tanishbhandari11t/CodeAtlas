export const KIND_META: Record<
  string,
  { color: string; bg: string; label: string; icon: string; size: "lg" | "md" | "sm" }
> = {
  district: {
    color: "#0d7a6f",
    bg: "#e6f5f3",
    label: "District",
    icon: "🏙",
    size: "lg",
  },
  service: {
    color: "#0d7a6f",
    bg: "#e6f5f3",
    label: "Service",
    icon: "🟩",
    size: "md",
  },
  controller: {
    color: "#0a6b5f",
    bg: "#e8f7f4",
    label: "API",
    icon: "🟢",
    size: "md",
  },
  middleware: {
    color: "#1a8a7a",
    bg: "#eef8f6",
    label: "Auth",
    icon: "🟩",
    size: "md",
  },
  client: {
    color: "#2d8a6e",
    bg: "#eef8f3",
    label: "Client",
    icon: "🟩",
    size: "md",
  },
  external: {
    color: "#5a8a7a",
    bg: "#f2f8f6",
    label: "Library",
    icon: "📚",
    size: "sm",
  },
  database: {
    color: "#2d6a4f",
    bg: "#e8f5ee",
    label: "Data",
    icon: "🟢",
    size: "md",
  },
  ui: {
    color: "#0d7a6f",
    bg: "#e6f5f3",
    label: "UI",
    icon: "🟩",
    size: "md",
  },
  infra: {
    color: "#3d7a6a",
    bg: "#eef6f3",
    label: "Infra",
    icon: "⚙️",
    size: "md",
  },
  module: {
    color: "#0d7a6f",
    bg: "#eef6f3",
    label: "Module",
    icon: "📦",
    size: "md",
  },
  package: {
    color: "#2d8a6e",
    bg: "#eef8f3",
    label: "Package",
    icon: "📦",
    size: "md",
  },
  function: {
    color: "#0d7a6f",
    bg: "#f4fbf9",
    label: "Function",
    icon: "ƒ",
    size: "sm",
  },
};

export const indexingSteps = [
  { id: "clone", label: "Cloning repository", detail: "Fetching your codebase" },
  { id: "detect", label: "Detecting languages", detail: "TypeScript · Python · Go…" },
  {
    id: "semantic",
    label: "Understanding architecture",
    detail: "Finding districts & services",
  },
  {
    id: "graph",
    label: "Building navigation map",
    detail: "Connecting the city",
  },
  { id: "ready", label: "Atlas ready", detail: "You can navigate now" },
];

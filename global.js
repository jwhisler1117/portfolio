console.log("IT’S ALIVE!");

// ===== Helpers =====
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}
const $ = (sel, ctx = document) => ctx.querySelector(sel);

function normalizePathname(p) {
  // Remove trailing "index.html" and collapse trailing slashes
  return (p || "/")
    .replace(/index\.html?$/i, "")
    .replace(/\/+$/, "") || "/";
}
function joinPath(base, slug) {
  if (/^https?:\/\//i.test(slug)) return slug;
  const u = new URL(base, location.origin);
  // Ensure base ends with slash
  const basePath = u.pathname.endsWith("/") ? u.pathname : u.pathname + "/";
  return basePath + slug;
}

// ===== Site map =====
const PAGES = [
  { url: "",          title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/",  title: "Contact" },
  { url: "resume/",   title: "Resume" },
  { url: "https://github.com/jwhisler1117", title: "GitHub" }, // external
];

// ===== Base path (localhost vs GitHub Pages) =====
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"              // dev
    : "/portfolio/";   // prod (adjust if your repo name/path changes)

// ===== Build nav =====
const nav = document.createElement("nav");
nav.setAttribute("aria-label", "Primary");
const list = document.createElement("ul");
nav.append(list);

// Insert theme switcher UI (top-right via your CSS)
const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
function autoLabelText() {
  return `Automatic (${prefersDarkMql.matches ? "Dark" : "Light"})`;
}
document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select id="color-scheme-select" aria-label="Theme">
      <option value="light dark">${prefersDark ? "Automatic (Dark)" : "Automatic (Light)"}</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

// Put the nav at the top
document.body.prepend(nav);

// Render links
const here = normalizePathname(location.pathname);
for (const { url: rawUrl, title } of PAGES) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : joinPath(BASE_PATH, rawUrl);

  const a = document.createElement("a");
  a.href = url;
  a.textContent = title;

  // External?
  if (a.host !== location.host) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }

  // Active link highlighting (normalize both)
  if (a.host === location.host) {
    const linkPath = normalizePathname(a.pathname);
    const isCurrent =
      linkPath === here ||
      (linkPath !== "/" && here.startsWith(linkPath)); // supports directory-style pages
    a.classList.toggle("current", isCurrent);
    if (isCurrent) a.setAttribute("aria-current", "page");
  }

  const li = document.createElement("li");
  li.append(a);
  list.append(li);
}

// ===== Theme handling (Auto | Light | Dark via color-scheme) =====
function setColorScheme(value) {
  // value: "light dark" | "light" | "dark"
  document.documentElement.style.setProperty("color-scheme", value);
}
const select = document.querySelector("#color-scheme-select");

const saved = localStorage.colorScheme;
if (saved) {
  setColorScheme(saved);
  if (select) select.value = saved;
} else {
  setColorScheme("light dark");
  if (select) select.value = "light dark";
}

// Update when user changes select
select?.addEventListener("change", (event) => {
  const value = event.target.value;                 // "light dark" | "light" | "dark"
  setColorScheme(value);
  localStorage.colorScheme = value;
  console.log("color scheme changed to", value);
});

// Keep the "Automatic (Dark/Light)" label live when OS theme flips
const prefersDarkMql = matchMedia("(prefers-color-scheme: dark)");
prefersDarkMql.addEventListener?.("change", () => {
  // Update option label text
  const autoOpt = select?.querySelector('option[value="light dark"]');
  if (autoOpt) autoOpt.textContent = autoLabelText();
  // If user is in auto mode, re-apply "light dark"
  if ((localStorage.colorScheme || "light dark") === "light dark") {
    setColorScheme("light dark");
  }
});

// ===== Legacy mailto forms (kept, but you can remove if unused) =====
const legacyMailtoForm = document.querySelector('form[action^="mailto:"]');
legacyMailtoForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(legacyMailtoForm);
  const action = legacyMailtoForm.getAttribute('action') || 'mailto:';

  const params = [];
  for (const [name, value] of data) {
    if (!value) continue;
    params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  const url = params.length ? `${action}?${params.join('&')}` : action;
  location.href = url;
});

// ===== Gmail compose form (preferred, no mailto) =====
const contactForm = document.querySelector("#contact-form");
contactForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = new FormData(contactForm);
  const to = "jwhisler@ucsd.edu";
  const subject = (data.get("subject") || "").toString().trim();
  const body = (data.get("body") || "").toString().trim();

  // Optional: basic guard (your HTML already has required)
  if (!subject || !body) return;

  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  url.searchParams.set("to", to);
  url.searchParams.set("su", subject);
  url.searchParams.set("body", body);
  url.searchParams.set("tf", "1");

  // Open compose in new tab; noopener for safety
  window.open(url.toString(), "_blank", "noopener");
});

// === JSON utilities for data-driven pages ===
export async function fetchJSON(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
    throw error;
  }
}

export function renderProjects(projects, containerElement, headingLevel = "h2") {
  if (!(containerElement instanceof Element)) {
    console.warn("renderProjects: invalid containerElement", containerElement);
    return;
  }
  if (!/^h[1-6]$/i.test(headingLevel)) headingLevel = "h2";
  containerElement.innerHTML = "";

  if (!Array.isArray(projects) || projects.length === 0) {
    const msg = document.createElement("p");
    msg.textContent = "No projects to display yet.";
    containerElement.appendChild(msg);
    return;
  }

  for (const project of projects) {
    const article = document.createElement("article");

    const h = document.createElement(headingLevel);
    h.textContent = project.title ?? "Untitled project";
    article.appendChild(h);

    if (project.image) {
      const img = document.createElement("img");
      img.src = project.image;
      img.alt = project.title ?? "";
      img.loading = "lazy";
      article.appendChild(img);
    }

    const p = document.createElement("p");
    p.textContent = project.description ?? "";
    article.appendChild(p);

    containerElement.appendChild(article);
  }
}

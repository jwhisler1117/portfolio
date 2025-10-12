console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}


const PAGES = [
  { url: "",          title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/",  title: "Contact" },
  { url: "resume/",   title: "Resume" },
  { url: "https://github.com/jwhisler1117", title: "GitHub" }, // external
];


const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"                
    : "/portfolio/";     


const nav = document.createElement("nav");
const list = document.createElement("ul");
nav.append(list);

/* ==========================
   Step 4: Color scheme switch
   ========================== */

// Build a small label + select and insert at the very top of <body>
const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
const autoLabel = `Automatic (${prefersDark ? "Dark" : "Light"})`;

document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select id="color-scheme-select">
      <option value="light dark">${autoLabel}</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

// Helper to apply the scheme to <html>
function setColorScheme(value) {
  document.documentElement.style.setProperty("color-scheme", value);
}

// Get the select and wire events
const select = document.querySelector("#color-scheme-select");

// On load: use saved preference if present, else default to Automatic
const saved = localStorage.colorScheme;
if (saved) {
  setColorScheme(saved);
  select.value = saved;
} else {
  setColorScheme("light dark");
  select.value = "light dark";
}

// When user changes the dropdown, apply + persist
select.addEventListener("input", (event) => {
  const value = event.target.value;            // "light dark" | "light" | "dark"
  setColorScheme(value);
  localStorage.colorScheme = value;            // persist across pages & reloads
  console.log("color scheme changed to", value);
});

document.body.prepend(nav);


for (const { url: rawUrl, title } of PAGES) {
  let url = rawUrl;


  url = /^https?:\/\//i.test(url) ? url : BASE_PATH + url;


  const a = document.createElement("a");
  a.href = url;
  a.textContent = title;


  if (a.host !== location.host) {
    a.target = "_blank";
    a.rel = "noopener";
  }


  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname
  );


  const li = document.createElement("li");
  li.append(a);
  list.append(li);
}


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


function setColorScheme(value) {
  document.documentElement.style.setProperty("color-scheme", value);
}


const select = document.querySelector("#color-scheme-select");


const saved = localStorage.colorScheme;
if (saved) {
  setColorScheme(saved);
  select.value = saved;
} else {
  setColorScheme("light dark");
  select.value = "light dark";
}


select.addEventListener("input", (event) => {
  const value = event.target.value;            
  setColorScheme(value);
  localStorage.colorScheme = value;            
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


const form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', (event) => {
  event.preventDefault(); 

  const data = new FormData(form);
  const action = form.getAttribute('action'); 

 
  const params = [];
  for (const [name, value] of data) {
    if (!value) continue;
    params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }

  
  const url = params.length ? `${action}?${params.join('&')}` : action;

  
  location.href = url;
});

// === Contact form → Gmail compose in browser ===
const contactForm = document.querySelector("#contact-form");

contactForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = new FormData(contactForm);
  const to = "jwhisler@ucsd.edu";              // your address
  const subject = data.get("subject") || "";
  const body = data.get("body") || "";

  // Build Gmail compose URL
  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");          // compose
  url.searchParams.set("fs", "1");             // full-screen compose
  url.searchParams.set("to", to);
  url.searchParams.set("su", subject);         // subject
  url.searchParams.set("body", body);          // body (Gmail decodes %0A as newlines)
  url.searchParams.set("tf", "1");             // focus compose

  // Open Gmail compose in a new tab
  window.open(url.toString(), "_blank");
});

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


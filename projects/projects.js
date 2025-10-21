import { fetchJSON, renderProjects } from "../global.js";

let projects = [];
try {
  projects = await fetchJSON("../lib/projects.json");
} catch (e) {
  // leave projects as []
}

const container = document.querySelector(".projects");
renderProjects(projects, container, "h2");

const titleEl = document.querySelector(".projects-title");
if (titleEl) {
  titleEl.textContent = `Projects (${Array.isArray(projects) ? projects.length : 0})`;
}

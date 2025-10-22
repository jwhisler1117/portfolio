// index.js (root)
import { fetchJSON, renderProjects } from "./global.js";

// Fetch all projects, then display the first three on the homepage
let projects = [];
try {
  // Using URL() makes the path robust on GitHub Pages
  projects = await fetchJSON(new URL("./lib/projects.json", import.meta.url));
} catch (e) {
  // If the JSON is missing or malformed, we'll render an empty state
  console.error("Failed to load projects.json for homepage:", e);
}

const container = document.querySelector(".projects");
if (container) {
  // Use h3 so your “Latest Projects” H2 stays the section heading
  renderProjects(projects.slice(0, 3), container, "h3");
}

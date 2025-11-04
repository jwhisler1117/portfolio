import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ----- Load projects and render list -----
let projects = [];
try {
  projects = await fetchJSON("../lib/projects.json");
} catch (e) { /* keep [] */ }

const container = document.querySelector(".projects");
const titleEl = document.querySelector(".projects-title");
const searchInput = document.querySelector(".searchBar");

function updateTitle(count) {
  if (titleEl) titleEl.textContent = `Projects (${count})`;
}


let currentQuery = "";
let selectedLabel = null; 

function filterByQuery(all, q) {
  const query = (q || "").trim().toLowerCase();
  if (!query) return all;
  return all.filter(p => Object.values(p).join("\n").toLowerCase().includes(query));
}

function applyFilterAndRender() {
  const afterSearch = filterByQuery(projects, currentQuery);
  const visible = selectedLabel
    ? afterSearch.filter(p => String(p.year) === selectedLabel)
    : afterSearch;

  renderProjects(visible, container, "h2");
  updateTitle(visible.length);

  
  renderPieChart(afterSearch);
}


// ----- D3 pie + legend (reactive) -----
function renderPieChart(projectsGiven) {
  const svg = d3.select("#projects-pie-plot");
  const legend = d3.select(".legend");

  // Clear previous
  svg.selectAll("*").remove();
  legend.selectAll("*").remove();

  if (!projectsGiven || projectsGiven.length === 0) return;

  // Group by year: [["2025", n], ...]
  const rolled = d3.rollups(
    projectsGiven.filter(d => d && d.year),
    v => v.length,
    d => String(d.year)
  );

  // {label, value}, newest first (or swap to sort by count)
  const data = rolled
    .map(([year, count]) => ({ label: year, value: count }))
    .sort((a, b) => Number(b.label) - Number(a.label));

  if (data.length === 0) return;

  const colors = d3.scaleOrdinal(d3.schemeTableau10)
    .domain(data.map(d => d.label));

  const arc = d3.arc().innerRadius(0).outerRadius(50);
  const pie = d3.pie().value(d => d.value).sort(null);
  const arcs = pie(data);

  // Draw slices
  const paths = svg.selectAll("path")
    .data(arcs)
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", d => colors(d.data.label))
    .classed("selected", d => selectedLabel === d.data.label)
    .append("title")
    .text(d => `${d.data.label}: ${d.data.value}`);

  // Build legend
  const items = legend.selectAll("li")
    .data(data)
    .enter()
    .append("li")
    .attr("class", d => `legend-item${selectedLabel === d.label ? " selected" : ""}`)
    .attr("style", d => `--color:${colors(d.label)}`)
    .html(d => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);

  // Click handlers (toggle selection by label)
  function toggleSelection(label) {
    selectedLabel = (selectedLabel === label) ? null : label;
    applyFilterAndRender(); // re-render list + pie + legend in sync
  }

  // Re-bind clicks to the newly drawn elements
  svg.selectAll("path").on("click", (_, d) => toggleSelection(d.data.label));
  legend.selectAll(".legend-item").on("click", (_, d) => toggleSelection(d.label));
}

// ----- Initial render -----
renderProjects(projects, container, "h2");
updateTitle(projects.length);
renderPieChart(projects);

// ----- Live search -----
searchInput?.addEventListener("input", (e) => {
  currentQuery = e.target.value;
  applyFilterAndRender();
});

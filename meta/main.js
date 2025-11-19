// meta/main.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';



let xScale, yScale;
let timeScale;
let commitProgress = 100;
let commitMaxTime;
let filteredCommits;

// color scale for technologies / line types (Step 2.4)
const colors = d3.scaleOrdinal(d3.schemeTableau10);

/* ---------- load CSV with row conversion ---------- */
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

/* ---------- commit processing ---------- */
const repo = 'jwhisler1117/portfolio';

function processCommits(data) {
  const commits = d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const { author, date, time, timezone, datetime } = lines[0];
    const ret = {
      id: commit,
      url: `https://github.com/${repo}/commit/${commit}`,
      author, date, time, timezone, datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };
    Object.defineProperty(ret, 'lines', {
      value: lines, enumerable: false, writable: false, configurable: false
    });
    return ret;
  });

  // sorting by time is fine even before scrollytelling
  return d3.sort(commits, d => d.datetime);
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const sx = xScale(commit.datetime);
  const sy = yScale(commit.hourFrac);
  return x0 <= sx && sx <= x1 && y0 <= sy && sy <= y1;
}

function renderSelectionCount(selection, commits) {
  const countEl = document.querySelector('#selection-count');
  const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];

  if (selected.length === 0) {
    countEl.hidden = true;
  } else {
    countEl.hidden = false;
    countEl.textContent = `${selected.length} commit${selected.length === 1 ? '' : 's'} selected`;
  }

  return selected;
}

function renderLanguageBreakdown(selection, commits) {
  const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');

  if (selected.length === 0) { container.innerHTML = ''; return; }

  const lines = selected.flatMap(d => d.lines);

  const breakdown = d3.rollup(
    lines,
    v => v.length,
    d => d.type
  );

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const pct = d3.format('.1~%')(proportion);
    container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${pct})</dd>`;
  }
}

/* ---------- summary stats ---------- */
function renderCommitInfo(data, commits) {
  const root = d3.select('#stats').html('');
  const dl = root.append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(d3.format(',')(data.length));

  dl.append('dt').text('Total commits');
  dl.append('dd').text(d3.format(',')(commits.length));

  const numFiles = d3.group(data, d => d.file).size;
  dl.append('dt').text('Files');
  dl.append('dd').text(numFiles);

  const fileLengths = d3.rollups(data, v => d3.max(v, r => r.line), d => d.file);
  const longestFile = d3.greatest(fileLengths, d => d[1]);
  if (longestFile) {
    dl.append('dt').text('Longest file (lines)');
    dl.append('dd').text(`${longestFile[1]} (${longestFile[0]})`);
  }

  const avgFileLen = d3.mean(fileLengths, d => d[1]);
  if (Number.isFinite(avgFileLen)) {
    dl.append('dt').text('Avg file length (lines)');
    dl.append('dd').text(avgFileLen.toFixed(1));
  }

  const maxDepth = d3.max(data, d => d.depth);
  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(maxDepth ?? '—');

  const workByPeriod = d3.rollups(
    data,
    v => v.length,
    d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'long' })
  );
  const maxPeriod = d3.greatest(workByPeriod, d => d[1])?.[0];
  if (maxPeriod) {
    dl.append('dt').text('Most active period');
    dl.append('dd').text(maxPeriod);
  }
}

/* ---------- tooltip helpers ---------- */
function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 10);
  date.textContent = commit.datetime?.toLocaleString('en', { dateStyle: 'full' }) ?? '';
  time.textContent = commit.datetime?.toLocaleTimeString('en', { timeStyle: 'short' }) ?? '';
  author.textContent = commit.author ?? 'Unknown';
  lines.textContent = d3.format(',')(commit.totalLines ?? 0);
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const pad = 12;
  let x = event.clientX + pad;
  let y = event.clientY + pad;

  const rect = tooltip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  if (x + rect.width > vw - 8) x = vw - rect.width - 8;
  if (y + rect.height > vh - 8) y = vh - rect.height - 8;

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

/* ---------- initial scatter plot ---------- */
function renderScatterPlot(_data, commits) {
  const width = 1000, height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 60 };

  const svg = d3.select('#chart').append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  const usable = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usable.left, usable.right])
    .nice();

  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usable.bottom, usable.top]);

  const grid = svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left},0)`);
  grid.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale)
    .ticks(12)
    .tickFormat(d => {
      const hour = d % 24;
      const period = hour < 12 ? 'AM' : 'PM';
      const display = hour % 12 === 0 ? 12 : hour % 12;
      return `${display} ${period}`;
    });

  svg.append('g')
    .attr('transform', `translate(0,${usable.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usable.left},0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  const warm = d3.scaleSequential([0, 24], d3.interpolateWarm);
  const cool = d3.scaleSequential([0, 24], d3.interpolateCool);
  const blendedColor = h => (h < 6 || h > 20) ? cool(h) : warm(h);

  let [minLines, maxLines] = d3.extent(commits, d => d.totalLines ?? 0);
  if (!(Number.isFinite(minLines) && Number.isFinite(maxLines))) { minLines = 0; maxLines = 1; }
  if (minLines === maxLines) minLines = 0;

  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const sortedCommits = d3.sort(commits, d => -d.totalLines);
  const dots = svg.append('g').attr('class', 'dots');

  dots.selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', d => blendedColor(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    })
    .append('title')
    .text(d => `${d.author ?? 'Unknown'} • ${d.datetime.toLocaleString()} • ${d.totalLines} line(s)`);

  const brush = d3.brush()
    .extent([[usable.left, usable.top], [usable.right, usable.bottom]])
    .on('start brush end', brushed);

  svg.call(brush);

  svg.select('.overlay').lower();
  dots.raise();

  function brushed(event) {
    const sel = event.selection;
    dots.selectAll('circle')
      .classed('selected', d => isCommitSelected(sel, d));
    renderSelectionCount(sel, commits);
    renderLanguageBreakdown(sel, commits);
  }
}

/* ---------- update scatter plot when filtered ---------- */
function updateScatterPlot(_data, commits) {
  const width = 1000, height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 60 };

  const usable = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  xScale = xScale.domain(d3.extent(commits, d => d.datetime));

  let [minLines, maxLines] = d3.extent(commits, d => d.totalLines ?? 0);
  if (!(Number.isFinite(minLines) && Number.isFinite(maxLines))) { minLines = 0; maxLines = 1; }
  if (minLines === maxLines) minLines = 0;
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup
    .attr('transform', `translate(0,${usable.bottom})`)
    .call(xAxis);

  const warm = d3.scaleSequential([0, 24], d3.interpolateWarm);
  const cool = d3.scaleSequential([0, 24], d3.interpolateCool);
  const blendedColor = h => (h < 6 || h > 20) ? cool(h) : warm(h);

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commits, d => -d.totalLines);

  dots.selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', d => blendedColor(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

/* ---------- Step 2: file unit visualization ---------- */
function updateFileDisplay(filteredCommits) {
  const filesRoot = d3.select('#files');
  if (filesRoot.empty()) return;

  const lines = filteredCommits.flatMap(d => d.lines ?? []);

  const files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = filesRoot
    .selectAll('div')
    .data(files, d => d.name)
    .join(
      enter => enter.append('div').call(div => {
        div.append('dt').append('code');
        div.append('dd');
      }),
      update => update,
      exit => exit.remove()
    );

  filesContainer.select('dt > code')
    .html(d => d.name);

  filesContainer.select('dt')
    .selectAll('small')
    .data(d => [d])
    .join('small')
    .text(d => `${d.lines.length} lines`);

  filesContainer
    .select('dd')
    .selectAll('div.loc')
    .data(d => d.lines, d => d?.line)
    .join('div')
    .attr('class', 'loc')
    .style('--color', d => colors(d.type));
}

/* ---------- slider handler ---------- */
function onTimeSliderChange(data, commits) {
  const slider = document.getElementById('commit-progress');
  const timeEl = document.getElementById('commit-slider-time');
  if (!slider || !timeEl) return;

  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  timeEl.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

  renderCommitInfo(data, filteredCommits);
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

/* ---------- run ---------- */
const data = await loadData();
const commits = processCommits(data);

timeScale = d3.scaleTime()
  .domain(d3.extent(commits, d => d.datetime))
  .range([0, 100]);

commitMaxTime = timeScale.invert(commitProgress);
filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

renderCommitInfo(data, filteredCommits);
renderScatterPlot(data, filteredCommits);
updateFileDisplay(filteredCommits);

const sliderEl = document.getElementById('commit-progress');
if (sliderEl) {
  sliderEl.addEventListener('input', () => onTimeSliderChange(data, commits));
  onTimeSliderChange(data, commits); // initialize slider label + filtered view
}

// === Step 3.2: Generate scrollytelling text ===

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html((d, i) => `
    <p>On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })}, I made 
      <a href="${d.url}" target="_blank">
        ${i === 0 ? "my first glorious commit" : "another glorious commit"}
      </a>.
    </p>

    <p>I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        v => v.length,
        x => x.file
      ).length
    } files.</p>

    <p>Then I looked over all I had made, and I saw that it was very good.</p>
  `);


function onStepEnter(response) {
  // Commit associated with this scrolly step
  const commit = response.element.__data__;
  if (!commit) return;

  console.log('Scrolling to commit:', commit.datetime);

  const slider = document.getElementById('commit-progress');
  if (!slider || typeof timeScale !== 'function') return;

  // Map this commit's datetime to the slider's 0–100 scale
  const cutoff = commit.datetime;
  commitMaxTime = cutoff; // keep global in sync
  const progress = timeScale(cutoff);  // datetime -> [0, 100]

  // Set slider value
  slider.value = progress;

  // Fire the same event as when the user drags the slider
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

// === Step 3.3: Scrollama wiring ===
const scroller = scrollama();

scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
    offset: 0.5, // trigger when step hits middle of viewport
  })
  .onStepEnter(onStepEnter);

window.addEventListener('resize', () => scroller.resize());

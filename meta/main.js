// meta/main.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';


let xScale, yScale;

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
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
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
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  // selection is [[x0,y0],[x1,y1]] in SVG (pixel) coords
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

  // flatten the lines from selected commits
  const lines = selected.flatMap(d => d.lines);

  // count lines per language/type
  const breakdown = d3.rollup(
    lines,
    v => v.length,
    d => d.type
  );

  // Render simple DL
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
    d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'long' }) // “in the afternoon”
  );
  const maxPeriod = d3.greatest(workByPeriod, d => d[1])?.[0];
  if (maxPeriod) {
    dl.append('dt').text('Most active period');
    dl.append('dd').text(maxPeriod);
  }
}

/* ---------- tooltip helpers (Step 3) ---------- */
function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 10); // short hash is nice
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
  const pad = 12; // offset from cursor
  let x = event.clientX + pad;
  let y = event.clientY + pad;

  // keep tooltip within viewport a bit
  const rect = tooltip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  if (x + rect.width > vw - 8) x = vw - rect.width - 8;
  if (y + rect.height > vh - 8) y = vh - rect.height - 8;

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

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

  // --- scales (assign to globals so helpers can use them)
  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usable.left, usable.right])
    .nice();

  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usable.bottom, usable.top]);

  // --- gridlines BEFORE axes
  const grid = svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left},0)`);
  grid.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // --- axes
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
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usable.left},0)`)
    .call(yAxis);

  // --- color & radius (Step 4 you already added)
  const warm = d3.scaleSequential([0, 24], d3.interpolateWarm);
  const cool = d3.scaleSequential([0, 24], d3.interpolateCool);
  const blendedColor = h => (h < 6 || h > 20) ? cool(h) : warm(h);

  let [minLines, maxLines] = d3.extent(commits, d => d.totalLines ?? 0);
  if (!(Number.isFinite(minLines) && Number.isFinite(maxLines))) { minLines = 0; maxLines = 1; }
  if (minLines === maxLines) minLines = 0;

  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // --- dots (big first, small last = small on top)
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

  // --- STEP 5: BRUSH
  const brush = d3.brush()
    .extent([[usable.left, usable.top], [usable.right, usable.bottom]])
    .on('start brush end', brushed);

// add brush
svg.call(brush);


svg.select('.overlay').lower(); 
dots.raise();                   


  function brushed(event) {
    const sel = event.selection;

    // style selected dots
    dots.selectAll('circle')
      .classed('selected', d => isCommitSelected(sel, d));

    // update readouts
    renderSelectionCount(sel, commits);
    renderLanguageBreakdown(sel, commits);
  }
}


/* ---------- run ---------- */
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

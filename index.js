import { fetchJSON, renderProjects, fetchGitHubData } from "./global.js";

// === Latest Projects (first 3) ===
let projects = [];
try {
  projects = await fetchJSON(new URL("./lib/projects.json", import.meta.url));
} catch (e) {
  console.error("Failed to load projects.json for homepage:", e);
}

const projectsContainer = document.querySelector(".projects");
if (projectsContainer) {
  renderProjects(projects.slice(0, 3), projectsContainer, "h3");
}

// === GitHub Profile Stats ===
// Use your actual GitHub username
const GITHUB_USER = "jwhisler1117";

const profileStats = document.querySelector("#profile-stats");
if (profileStats) {
  profileStats.innerHTML = `<p>Loading GitHub stats…</p>`;
  try {
    const githubData = await fetchGitHubData(GITHUB_USER);
    // githubData is a plain object with fields like public_repos, followers, etc.

    profileStats.innerHTML = `
      <div class="profile-card">
        <header class="profile-header">
          <img src="${githubData.avatar_url}" alt="${githubData.login} avatar" loading="lazy" width="64" height="64">
          <div class="profile-id">
            <strong>${githubData.name ?? githubData.login}</strong>
            <div><a href="${githubData.html_url}" target="_blank" rel="noopener">@${githubData.login}</a></div>
          </div>
        </header>

        <dl class="profile-grid">
          <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
          <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
          <dt>Followers</dt><dd>${githubData.followers}</dd>
          <dt>Following</dt><dd>${githubData.following}</dd>
        </dl>
      </div>
    `;
  } catch (err) {
    console.error("GitHub fetch failed:", err);
    profileStats.innerHTML = `<p>Couldn’t load GitHub stats right now. Please try again later.</p>`;
  }
}

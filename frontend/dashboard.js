// dashboard.js — version finale simplifiée (sans répartition par type)
(function () {
  async function fetchViewing() {
    const res = await fetch(`${window.location.origin}/metrics/viewing`, { cache: 'no-store' });
    if (!res.ok) throw new Error('metrics/viewing KO');
    return res.json();
  }

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  function ensureScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureChartJs() {
    if (typeof window.Chart === 'function') return Promise.resolve();
    return ensureScript('https://cdn.jsdelivr.net/npm/chart.js');
  }

  function ensureDataLabels() {
    if (window.ChartDataLabels) return Promise.resolve();
    return ensureScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0');
  }

  function popflixPalette() {
    return [
      '#FF8C94', '#FFB347', '#C774E8', '#A8E6CF', '#6FD08C',
      '#4C8BF5', '#FFD966', '#A685E2', '#5AC8FA', '#F7A1E3', '#B3B3B3'
    ];
  }

  const labelColor = '#cfe8ff';

  // -------- Adaptateur données simplifié --------
  function buildSafeViewing(raw) {
    const d = raw || {};
    const counts = {
      movies: Number(d?.counts?.movies ?? 0),
      series: Number(d?.counts?.series ?? 0)
    };

    const by_genre_movies = Array.isArray(d?.by_genre_movies) ? d.by_genre_movies.slice() : [];
    let by_genre_series   = Array.isArray(d?.by_genre_series) ? d.by_genre_series.slice() : [];

    // Fallback séries si rien côté backend
    if (!by_genre_series.length || !counts.series) {
      try {
        const wl = JSON.parse(localStorage.getItem('watchlist') || '[]');
        const ws = JSON.parse(localStorage.getItem('wishlist') || '[]');
        const all = [...wl, ...ws];
        const series = all.filter(it => (it?.type || '').toLowerCase().startsWith('s'));
        const films  = all.filter(it => (it?.type || '').toLowerCase().startsWith('f'));
        if (!counts.series) counts.series = series.length;
        if (!counts.movies) counts.movies = films.length;

        if (!by_genre_series.length && series.length) {
          const m = new Map();
          for (const s of series) {
            const g = (s?.genre || 'Autre').trim();
            m.set(g, (m.get(g) || 0) + 1);
          }
          by_genre_series = [...m.entries()].map(([genre, count]) => ({ genre, count }));
        }
      } catch {}
    }

    return { counts, by_genre_movies, by_genre_series };
  }

  // -------- Rendu principal --------
  window.renderDashboard = async function renderDashboard(rootSel = '#dashboard-root', { requireLogin = true } = {}) {
    const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
    if (!root) return;

    try {
      if (requireLogin && typeof window.requireAuth === 'function') {
        const user = await window.requireAuth();
        if (!user) return;
      } else if (typeof window.initAuth === 'function') {
        await window.initAuth();
      }
    } catch {}

    root.innerHTML = `
      <h2>Tableau de bord</h2>

      <div class="pf-kpi-grid">
        <div class="pf-kpi">
          <div class="label">Films vus</div>
          <div id="stat-films" class="value">—</div>
        </div>
        <div class="pf-kpi">
          <div class="label">Séries vues</div>
          <div id="stat-series" class="value">—</div>
        </div>
      </div>

      <div class="pf-chart-grid">
        <article class="pf-card">
          <h3>Genres — Films</h3>
          <div class="chart-wrap"><canvas id="chartGenresMovies"></canvas></div>
        </article>

        <article class="pf-card">
          <h3>Genres — Séries</h3>
          <div class="chart-wrap"><canvas id="chartGenresSeries"></canvas></div>
        </article>
      </div>
    `;

    let raw = {};
    try {
      raw = await fetchViewing();
    } catch (e) {
      console.warn('metrics/viewing indisponible, fallback activé');
    }

    const data = buildSafeViewing(raw);

    // KPIs
    setText('stat-films',  data.counts.movies);
    setText('stat-series', data.counts.series);

    await ensureChartJs();
    await ensureDataLabels();
    if (window.ChartDataLabels && window.Chart?.register) Chart.register(ChartDataLabels);

    const colors = popflixPalette();

    const commonPlugins = {
      legend: {
        position: 'top',
        labels: { color: labelColor, boxWidth: 14, boxHeight: 14, padding: 12, font: { size: 13, weight: '500' } }
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (ctx) => {
            const dsData = ctx.dataset.data;
            const total = dsData.reduce((a,b)=>a+b,0);
            const pct = total ? ((ctx.parsed/total)*100).toFixed(1) : 0;
            return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
          }
        }
      },
      datalabels: {
        color: '#fff',
        font: { weight: '600', size: 12 },
        formatter: (value, context) => {
          const arr = context.dataset.data;
          const total = arr.reduce((a,b)=>a+b,0);
          const pct = total ? Math.round((value/total)*100) : 0;
          return pct >= 5 ? pct + '%' : '';
        }
      }
    };

    // --- Donut : Films
    const ctxMovies = document.getElementById('chartGenresMovies');
    if (data.by_genre_movies?.length && ctxMovies) {
      new Chart(ctxMovies, {
        type: 'doughnut',
        data: {
          labels: data.by_genre_movies.map(g => g.genre),
          datasets: [{
            data: data.by_genre_movies.map(g => g.count),
            backgroundColor: colors,
            borderColor: '#0b2430',
            borderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
          cutout: '58%',
          plugins: commonPlugins
        }
      });
    }

    // --- Donut : Séries
    const ctxSeries = document.getElementById('chartGenresSeries');
    if (data.by_genre_series?.length && ctxSeries) {
      new Chart(ctxSeries, {
        type: 'doughnut',
        data: {
          labels: data.by_genre_series.map(g => g.genre),
          datasets: [{
            data: data.by_genre_series.map(g => g.count),
            backgroundColor: colors,
            borderColor: '#0b2430',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
          cutout: '58%',
          plugins: commonPlugins
        }
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const auto = document.querySelector('[data-auto-dashboard="1"]');
    if (auto) window.renderDashboard(auto);
  });
})();

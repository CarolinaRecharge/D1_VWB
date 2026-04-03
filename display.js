// display.js — TV workout board logic
// Fetches today's workout from Supabase and renders the 2×2 board.

(function () {
  'use strict';

  const TRACKS = ['Adult', 'Devo', 'Rookie', 'Prep'];
  const SECTION_ORDER = ['P', 'S', 'C&C'];
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  let supabaseClient = null;
  let currentDay = null;
  let currentWeekStart = null;

  // ── Date helpers ─────────────────────────────────────────────────────────────

  function getMondayOfWeek(date) {
    const d = new Date(date);
    // getDay(): 0=Sun 1=Mon … 6=Sat
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // shift to previous Monday
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  function getDayName(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  // ── HTML escaping ─────────────────────────────────────────────────────────────

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function buildExerciseLine(row) {
    const label = escHtml(row.exercise_label);
    const name  = escHtml(row.exercise_name);
    let line = label ? `${label})&nbsp;${name}` : escHtml(row.exercise_name);
    if (row.sets && row.reps) {
      line += `&nbsp;&nbsp;${escHtml(String(row.sets))}<span style="font-size:0.85em">×</span>${escHtml(row.reps)}`;
    } else if (row.sets) {
      line += `&nbsp;&nbsp;${escHtml(String(row.sets))}×`;
    } else if (row.reps) {
      line += `&nbsp;&nbsp;${escHtml(row.reps)}`;
    }
    return line;
  }

  // ── Font fitting ──────────────────────────────────────────────────────────────
  // Binary-searches for the largest integer px font-size where all content fits
  // inside the quadrant — both vertically (scrollHeight) and horizontally
  // (no exercise row overflows its container width, since they are nowrap).

  function fitTrackContent(trackName) {
    const content = document.getElementById('content-' + trackName);
    if (!content) return;

    const availH = content.clientHeight;
    const availW = content.clientWidth;
    if (!availH || !availW) return;

    // Reset before measuring so we don't compound previous adjustments
    content.style.fontSize = '';

    let lo = 9, hi = 58, best = lo;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      content.style.fontSize = mid + 'px';

      const overflowsH = content.scrollHeight > availH;
      const overflowsW = Array.from(content.querySelectorAll('.exercise-row'))
        .some(r => r.scrollWidth > r.clientWidth);

      if (!overflowsH && !overflowsW) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    content.style.fontSize = best + 'px';
  }

  function fitAllTracks() {
    TRACKS.forEach(t => fitTrackContent(t));
  }

  function renderTrack(trackName, rows) {
    const el = document.getElementById('content-' + trackName);
    if (!el) return;

    if (rows.length === 0) {
      el.innerHTML = '<div class="no-workout">No workout loaded</div>';
      return;
    }

    // Group by section, preserving the canonical section order
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.section]) grouped[row.section] = [];
      grouped[row.section].push(row);
    });

    let html = '';
    SECTION_ORDER.forEach(section => {
      if (!grouped[section] || grouped[section].length === 0) return;

      // Sort within section by section_order
      const sectionRows = grouped[section].slice().sort((a, b) => a.section_order - b.section_order);

      html += `<div class="section-block">`;
      html += `<span class="section-tag">${escHtml(section)}</span>`;

      sectionRows.forEach(row => {
        if (row.exercise_label === '') {
          // Motivational / notes row
          html += `<div class="motivational-row">${escHtml(row.exercise_name)}</div>`;
        } else {
          html += `<div class="exercise-row">${buildExerciseLine(row)}</div>`;
        }
      });

      html += `</div>`;
    });

    el.innerHTML = html;
  }

  // ── Data loading ──────────────────────────────────────────────────────────────

  async function loadWorkout(dayName, weekStart) {
    // Show loading state
    TRACKS.forEach(t => {
      const el = document.getElementById('content-' + t);
      if (el) el.innerHTML = '<div class="loading-indicator">Loading…</div>';
    });

    const { data, error } = await supabaseClient
      .from('workouts')
      .select('*')
      .eq('day_of_week', dayName)
      .eq('week_start_date', weekStart)
      .order('section_order', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      TRACKS.forEach(t => {
        const el = document.getElementById('content-' + t);
        if (el) el.innerHTML = '<div class="no-workout">Error loading workout.</div>';
      });
      return;
    }

    // Check if ALL tracks are empty
    const allEmpty = !data || data.length === 0;
    if (allEmpty) {
      const board = document.getElementById('board');
      // Temporarily show a centered message across the whole board
      TRACKS.forEach(t => {
        const el = document.getElementById('content-' + t);
        if (el) el.innerHTML = '<div class="no-workout">No workout loaded for today.</div>';
      });
      return;
    }

    // Render each track, then fit font sizes once layout is stable
    TRACKS.forEach(track => {
      const trackRows = data.filter(r => r.track === track);
      renderTrack(track, trackRows);
    });

    requestAnimationFrame(fitAllTracks);
  }

  // ── Day pill UI ───────────────────────────────────────────────────────────────

  function setActiveDay(dayName) {
    currentDay = dayName;
    document.querySelectorAll('.day-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.day === dayName);
    });
    loadWorkout(currentDay, currentWeekStart);
  }

  function initDayPills() {
    document.querySelectorAll('.day-pill').forEach(btn => {
      btn.addEventListener('click', () => setActiveDay(btn.dataset.day));
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────

  async function init() {
    try {
      supabaseClient = await initSupabase(false);
    } catch (err) {
      TRACKS.forEach(t => {
        const el = document.getElementById('content-' + t);
        if (el) el.innerHTML = '<div class="no-workout">Failed to connect to database.</div>';
      });
      console.error(err);
      return;
    }

    const today = new Date();
    currentWeekStart = getMondayOfWeek(today);
    const todayName = getDayName(today);

    initDayPills();
    setActiveDay(todayName);

    // Auto-refresh every 5 minutes
    setInterval(() => {
      loadWorkout(currentDay, currentWeekStart);
    }, REFRESH_INTERVAL_MS);

    // Re-fit on window resize (debounced)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitAllTracks, 150);
    });

    // Re-fit after web fonts finish loading (Caveat affects line metrics)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitAllTracks);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

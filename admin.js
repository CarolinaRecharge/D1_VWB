// admin.js — Admin panel logic
// Handles password gate, workout table CRUD, and SQL execution.

(function () {
  'use strict';

  // ── Change this password directly in this file ────────────────────────────────
  const ADMIN_PASSWORD = 'D1Training';
  // ─────────────────────────────────────────────────────────────────────────────

  const SESSION_KEY = 'admin_authed';

  let supabaseClient = null;
  let selectedDay = 'Monday';
  let selectedTrack = 'Adult';
  let selectedWeekStart = '';

  // ── Date helpers ──────────────────────────────────────────────────────────────

  function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun … 6=Sat
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  function toDateInputValue(isoDate) {
    // Returns YYYY-MM-DD suitable for <input type="date">
    return isoDate;
  }

  // ── HTML escaping ─────────────────────────────────────────────────────────────

  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Auth / password gate ──────────────────────────────────────────────────────

  function setupAuth() {
    const gate     = document.getElementById('auth-gate');
    const main     = document.getElementById('admin-main');
    const pwInput  = document.getElementById('pw-input');
    const pwSubmit = document.getElementById('pw-submit');
    const authErr  = document.getElementById('auth-error');

    function unlock() {
      gate.style.display = 'none';
      main.style.display = 'block';
      initAdmin();
    }

    // Already authenticated this session?
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      unlock();
      return;
    }

    gate.style.display = 'flex';

    function tryAuth() {
      if (pwInput.value === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, '1');
        authErr.textContent = '';
        unlock();
      } else {
        authErr.textContent = 'Incorrect password.';
        pwInput.value = '';
        pwInput.focus();
      }
    }

    pwSubmit.addEventListener('click', tryAuth);
    pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryAuth(); });
  }

  // ── Toast notifications ───────────────────────────────────────────────────────

  let toastTimer = null;

  function showToast(msg, type = 'success') {
    const toast = document.getElementById('sql-toast');
    toast.textContent = msg;
    toast.className = `toast ${type} visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 4000);
  }

  // ── Table rendering ───────────────────────────────────────────────────────────

  async function loadTable() {
    if (!supabaseClient || !selectedWeekStart) return;

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty loading-indicator">Loading…</td></tr>';

    const { data, error } = await supabaseClient
      .from('workouts')
      .select('*')
      .eq('track', selectedTrack)
      .eq('day_of_week', selectedDay)
      .eq('week_start_date', selectedWeekStart)
      .order('section')
      .order('section_order', { ascending: true });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty" style="color:#e74c3c">Error: ${escHtml(error.message)}</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No exercises loaded for this selection.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(row => `
      <tr>
        <td class="section-cell">${escHtml(row.section)}</td>
        <td>${escHtml(String(row.section_order))}</td>
        <td class="label-cell">${escHtml(row.exercise_label)}</td>
        <td>${escHtml(row.exercise_name)}</td>
        <td>${row.sets !== null ? escHtml(String(row.sets)) : ''}</td>
        <td>${escHtml(row.reps || '')}</td>
        <td>${escHtml(row.notes || '')}</td>
        <td><button class="btn-delete" data-id="${escHtml(row.id)}">Delete</button></td>
      </tr>
    `).join('');

    // Attach delete handlers
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteRow(btn.dataset.id));
    });
  }

  // ── CRUD operations ───────────────────────────────────────────────────────────

  async function deleteRow(id) {
    if (!confirm('Delete this exercise row?')) return;

    const { error } = await supabaseClient
      .from('workouts')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      loadTable();
    }
  }

  async function clearDay() {
    if (!selectedWeekStart) return;
    const msg = `Delete ALL rows for ${selectedTrack} / ${selectedDay} / week of ${selectedWeekStart}?`;
    if (!confirm(msg)) return;

    const { error } = await supabaseClient
      .from('workouts')
      .delete()
      .eq('track', selectedTrack)
      .eq('day_of_week', selectedDay)
      .eq('week_start_date', selectedWeekStart);

    if (error) {
      alert('Clear day failed: ' + error.message);
    } else {
      loadTable();
    }
  }

  async function clearWeek() {
    if (!selectedWeekStart) return;
    const msg = `Delete ALL workouts for ALL tracks for the week of ${selectedWeekStart}?\n\nThis cannot be undone.`;
    if (!confirm(msg)) return;

    const { error } = await supabaseClient
      .from('workouts')
      .delete()
      .eq('week_start_date', selectedWeekStart);

    if (error) {
      alert('Clear week failed: ' + error.message);
    } else {
      loadTable();
    }
  }

  // ── SQL execution ─────────────────────────────────────────────────────────────

  async function executeSQL() {
    const sql = document.getElementById('sql-input').value.trim();
    if (!sql) {
      showToast('SQL input is empty.', 'error');
      return;
    }

    const btn = document.getElementById('execute-btn');
    btn.disabled = true;
    btn.textContent = 'Executing…';

    try {
      const { error } = await supabaseClient.rpc('exec_sql', { sql });
      if (error) {
        showToast('Error: ' + error.message, 'error');
      } else {
        showToast('SQL executed successfully.', 'success');
        loadTable(); // Refresh table to show newly inserted rows
      }
    } catch (err) {
      showToast('Unexpected error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Execute';
    }
  }

  // ── Tab & selector UI ─────────────────────────────────────────────────────────

  function setActiveDayTab(day) {
    selectedDay = day;
    document.querySelectorAll('#day-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.day === day);
    });
    loadTable();
  }

  function setActiveTrackTab(track) {
    selectedTrack = track;
    document.querySelectorAll('#track-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.track === track);
    });
    loadTable();
  }

  function initTabGroups() {
    document.querySelectorAll('#day-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setActiveDayTab(btn.dataset.day));
    });

    document.querySelectorAll('#track-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setActiveTrackTab(btn.dataset.track));
    });
  }

  function initWeekPicker() {
    const input = document.getElementById('week-input');

    input.addEventListener('change', () => {
      if (!input.value) return;
      // Snap to Monday of the selected date's week
      const monday = getMondayOfWeek(input.value + 'T12:00:00'); // noon to avoid TZ edge cases
      selectedWeekStart = monday;
      input.value = toDateInputValue(monday);
      loadTable();
    });

    // Default to current week's Monday
    const today = new Date();
    const monday = getMondayOfWeek(today);
    selectedWeekStart = monday;
    input.value = toDateInputValue(monday);
  }

  // ── Initialize admin UI ───────────────────────────────────────────────────────

  async function initAdmin() {
    try {
      supabaseClient = await initSupabase(true); // use service role key
    } catch (err) {
      alert('Failed to connect to Supabase:\n' + err.message);
      return;
    }

    initWeekPicker();
    initTabGroups();

    // Set defaults
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = days[today.getDay()];
    // Default day: today if Mon–Sat, otherwise Monday
    const defaultDay = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].includes(todayName)
      ? todayName
      : 'Monday';

    setActiveDayTab(defaultDay);
    setActiveTrackTab('Adult');

    // Action buttons
    document.getElementById('clear-day-btn').addEventListener('click', clearDay);
    document.getElementById('clear-week-btn').addEventListener('click', clearWeek);
    document.getElementById('execute-btn').addEventListener('click', executeSQL);
    document.getElementById('clear-sql-btn').addEventListener('click', () => {
      document.getElementById('sql-input').value = '';
    });
  }

  // ── Entry point ───────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', setupAuth);
})();

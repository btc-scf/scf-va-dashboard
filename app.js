const leadTrackerUrl = 'https://docs.google.com/spreadsheets/d/1IdCua919BwTqs-dwU1lcO1_ldE4Pp_mbIToGqLWZLuU/edit?usp=drivesdk';
const supabaseUrl = 'https://hvouvsqxoxukgoefpuok.supabase.co/rest/v1';
const supabaseKey = 'sb_publishable_wRSdpAX-xp4kGo-ZRcOLVQ_ngaWyMVW';
const supabaseHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`
};

function parseHyperlink(value) {
  if (!value) return null;
  const match = value.match(/HYPERLINK\("([^\"]+)"(?:,"([^"]+)")?\)/i);
  if (!match) return null;
  return { href: match[1], label: match[2] || 'Link' };
}

function updateSummary(data) {
  document.getElementById('total-leads').textContent = data.length;
  document.getElementById('linked-leads').textContent = data.filter(row => row['Link to lead sheet']).length;
}

function renderDetailPanel(lead) {
  if (!lead) {
    document.getElementById('detail-subtitle').textContent = 'Select a lead to see details.';
    document.getElementById('detail-why').textContent = 'No lead selected yet.';
    document.getElementById('detail-angle-summary').textContent = '—';
    document.getElementById('detail-next-task').textContent = '—';
    return;
  }
  document.getElementById('detail-subtitle').textContent = `${lead.Client} — ${lead.Funnel}`;
  document.getElementById('detail-why').textContent = lead.Notes || '—';
  document.getElementById('detail-angle-summary').textContent = lead['VA Task'] || '—';
  const nextText = lead['Doc Link'] ? 'Execute next task from the VA playbook.' : 'No playbook step assigned yet.';
  document.getElementById('detail-next-task').textContent = nextText;
}

function renderTable(data) {
  const tbody = document.querySelector('#lead-table tbody');
  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    ['Client', 'Offer', 'Funnel'].forEach(key => {
      const td = document.createElement('td');
      td.textContent = row[key] || '—';
      tr.appendChild(td);
    });
    const leadSheetCell = document.createElement('td');
    const leadSheetLink = parseHyperlink(row['Link to lead sheet']);
    if (leadSheetLink) {
      const a = document.createElement('a');
      a.href = leadSheetLink.href;
      a.textContent = leadSheetLink.label;
      a.target = '_blank';
      leadSheetCell.appendChild(a);
    } else {
      leadSheetCell.textContent = '—';
    }
    tr.appendChild(leadSheetCell);
    const docCell = document.createElement('td');
    const docLink = parseHyperlink(row['Doc Link']);
    if (docLink) {
      const a = document.createElement('a');
      a.href = docLink.href;
      a.textContent = docLink.label;
      a.target = '_blank';
      docCell.appendChild(a);
    } else {
      docCell.textContent = '—';
    }
    tr.appendChild(docCell);
    const taskCell = document.createElement('td');
    taskCell.textContent = row['VA Task'] || '—';
    tr.appendChild(taskCell);
    tr.addEventListener('click', () => {
      document.querySelectorAll('#lead-table tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      renderDetailPanel(row);
    });
    tbody.appendChild(tr);
  });
}

function renderPlaybookSteps(steps) {
  const container = document.getElementById('playbook-steps');
  container.innerHTML = '';
  if (!steps.length) {
    container.innerHTML = '<p class="muted">No playbook steps available.</p>';
    return;
  }
  steps.forEach(step => {
    const card = document.createElement('article');
    card.className = 'playbook-card';
    const title = document.createElement('h3');
    title.textContent = `${step.lead_name || 'Lead'} — Step ${step.step_label}`;
    card.appendChild(title);
    const action = document.createElement('p');
    action.innerHTML = `<strong>Action:</strong> ${step.action}`;
    card.appendChild(action);
    const medium = document.createElement('p');
    medium.innerHTML = `<strong>Medium:</strong> ${step.medium}`;
    card.appendChild(medium);
    const message = document.createElement('p');
    message.innerHTML = `<strong>Message:</strong> ${step.message}`;
    card.appendChild(message);
    const detail = document.createElement('div');
    detail.className = 'playbook-detail';
    detail.textContent = step.notes || 'Tap to expand for more context.';
    card.appendChild(detail);
    card.addEventListener('click', () => card.classList.toggle('expanded'));
    container.appendChild(card);
  });
}

function renderTaskList(steps) {
  const board = document.getElementById('task-board');
  board.innerHTML = '';
  const tasks = steps.slice(0, 6);
  document.getElementById('active-tasks').textContent = tasks.length;
  if (!tasks.length) {
    board.innerHTML = '<p class="muted">Waiting for playbook steps...</p>';
    return;
  }
  tasks.forEach(step => {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
      <header>
        <span>${step.lead_name || 'Lead'}</span>
        <strong>Step ${step.step_label}</strong>
      </header>
      <p>${step.action}</p>
      <small>${step.medium}</small>
    `;
    board.appendChild(card);
  });
}

async function fetchSupabase(path) {
  const response = await fetch(`${supabaseUrl}/${path}`, {
    headers: supabaseHeaders
  });
  if (!response.ok) throw new Error('Supabase request failed');
  return response.json();
}

async function fetchLeads() {
  try {
    const data = await fetchSupabase('leads?select=*');
    return data.map(row => ({
      Client: row.name,
      Offer: row.offer,
      Funnel: row.funnel_type,
      'Link to lead sheet': row.lead_sheet_link,
      'Doc Link': row.doc_link,
      'VA Task': row.va_task,
      Notes: row.notes
    }));
  } catch (error) {
    console.warn(error);
    return fetch('data/client-outreach-plan.json').then(res => res.json());
  }
}

async function fetchPlaybookSteps() {
  try {
    return await fetchSupabase(
      'playbook_steps?select=lead_name,step_label,action,medium,message,notes&order=lead_name.asc,step_label.asc&limit=12'
    );
  } catch (error) {
    console.warn(error);
    return [];
  }
}

async function initDashboard() {
  const leads = await fetchLeads();
  updateSummary(leads);
  renderTable(leads);
  renderDetailPanel(null);
  const steps = await fetchPlaybookSteps();
  renderPlaybookSteps(steps);
  renderTaskList(steps);
}

function setupControls() {
  document.getElementById('refresh-data-btn').addEventListener('click', async () => {
    const btn = document.getElementById('refresh-data-btn');
    btn.disabled = true;
    await initDashboard();
    btn.disabled = false;
  });
  document.getElementById('open-playbook').addEventListener('click', () => {
    window.open(leadTrackerUrl, '_blank');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupControls();
  initDashboard();
});

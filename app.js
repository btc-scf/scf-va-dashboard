const supabaseUrl = 'https://hvouvsqxoxukgoefpuok.supabase.co/rest/v1';
const supabaseKey = 'sb_publishable_wRSdpAX-xp4kGo-ZRcOLVQ_ngaWyMVW';
const supabaseHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`
};

function parseHyperlink(value) {
  if (!value) return null;
  const match = value.match(/HYPERLINK\("([^"]+)"(?:,"([^"]+)")?\)/i);
  if (!match) return null;
  return { href: match[1], label: match[2] || 'Link' };
}

function updateSummary(data) {
  document.getElementById('total-leads').textContent = data.length;
  document.getElementById('linked-leads').textContent = data.filter(row => row['Link to lead sheet']).length;
}

function renderTable(data) {
  const tbody = document.querySelector('#lead-table tbody');
  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');

    const cells = [
      row['Client'],
      row['Offer'],
      row['Funnel']
    ];

    cells.forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
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
    taskCell.textContent = row['VA Task'];
    tr.appendChild(taskCell);

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
    title.textContent = `${step.lead_name} — Step ${step.step_label}`;
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
    container.appendChild(card);
  });
}

async function fetchLeads() {
  try {
    const response = await fetch(`${supabaseUrl}/leads?select=*`, {
      headers: supabaseHeaders
    });
    if (!response.ok) throw new Error('Supabase lead fetch failed');
    return await response.json();
  } catch (error) {
    console.warn(error);
    const fallback = await fetch('data/client-outreach-plan.json');
    return fallback.json();
  }
}

async function fetchPlaybookSteps() {
  try {
    const response = await fetch(
      `${supabaseUrl}/playbook_steps?select=lead_name,step_label,action,medium,message&order=lead_name.asc,step_label.asc&limit=6`,
      { headers: supabaseHeaders }
    );
    if (!response.ok) throw new Error('Supabase steps failed');
    return response.json();
  } catch (error) {
    console.warn(error);
    return [];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const leads = await fetchLeads();
  updateSummary(leads);
  renderTable(leads);
  const steps = await fetchPlaybookSteps();
  renderPlaybookSteps(steps);
});

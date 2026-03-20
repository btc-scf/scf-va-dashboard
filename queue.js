const queueBody = document.getElementById('queue-body');
const statusFilter = document.getElementById('filter-status');
const priorityFilter = document.getElementById('filter-priority');
const searchInput = document.getElementById('queue-search');
const detailName = document.getElementById('detail-name');
const detailCompany = document.getElementById('detail-company');
const detailTitle = document.getElementById('detail-title');
const detailContact = document.getElementById('detail-contact');
const detailWhy = document.getElementById('detail-why');
const detailAngle = document.getElementById('detail-angle');
const detailHooks = document.getElementById('detail-hooks');
const detailNextAction = document.getElementById('detail-next-action');
const detailNextButton = document.getElementById('complete-next-action');
const taskList = document.getElementById('detail-tasks');
const playbookList = document.getElementById('detail-playbook');
const notesContainer = document.getElementById('detail-notes');

let allLeads = [];
let nextActionMap = new Map();
let currentLeadId = null;
let searchTimeout;

function formatString(value, fallback = '—') {
  return value && value !== 'undefined' ? value : fallback;
}

function buildNextActionMap(tasks) {
  const map = new Map();
  const pending = tasks
    .filter(task => task.status !== 'done')
    .sort((a, b) => {
      if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at);
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return 0;
    });
  pending.forEach(task => {
    if (!map.has(task.lead_id)) {
      map.set(task.lead_id, task);
    }
  });
  return map;
}

function renderTable(leads) {
  queueBody.innerHTML = '';
  if (!leads.length) {
    queueBody.innerHTML = '<tr><td colspan="6" class="muted">No leads match the filters.</td></tr>';
    return;
  }
  leads.forEach(lead => {
    const tr = document.createElement('tr');
    const nextAction = nextActionMap.get(lead.id);
    tr.classList.toggle('selected', lead.id === currentLeadId);
    tr.dataset.leadId = lead.id;
    tr.innerHTML = `
      <td>${formatString(lead.full_name, 'Name unknown')}</td>
      <td>${formatString(lead.company, 'Company n/a')}</td>
      <td>${formatString(lead.title, 'Title n/a')}</td>
      <td>${formatString(lead.status)}</td>
      <td>${formatString(lead.priority)}</td>
      <td>${nextAction ? `${formatString(nextAction.title)}${nextAction.due_at ? ' · due ' + new Date(nextAction.due_at).toLocaleDateString() : ''}` : 'No action yet'}</td>
    `;
    tr.addEventListener('click', () => selectLead(lead));
    queueBody.appendChild(tr);
  });
}

async function loadQueue() {
  allLeads = await fetchLeads();
  const tasks = await fetchTasks();
  nextActionMap = buildNextActionMap(tasks);
  const visibleLeads = filterLeads(allLeads);
  renderTable(visibleLeads);
  if (!currentLeadId && visibleLeads.length) {
    selectLead(visibleLeads[0]);
  } else if (currentLeadId) {
    const updatedLead = visibleLeads.find(l => l.id === currentLeadId);
    if (updatedLead) selectLead(updatedLead);
  }
}

function filterLeads(leads) {
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  const search = searchInput.value.toLowerCase();
  return leads.filter(lead => {
    if (status && lead.status !== status) return false;
    if (priority && lead.priority !== priority) return false;
    if (search) {
      const haystack = `${lead.full_name} ${lead.company} ${lead.angle_summary || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

async function selectLead(lead) {
  currentLeadId = lead.id;
  document.querySelectorAll('#queue-body tr').forEach(row => row.classList.remove('selected'));
  const row = document.querySelector(`#queue-body tr[data-lead-id="${lead.id}"]`);
  if (row) row.classList.add('selected');
  detailName.textContent = formatString(lead.full_name, 'Name missing');
  detailCompany.textContent = formatString(lead.company, 'Company unknown');
  detailTitle.textContent = formatString(lead.title, 'Title unknown');
  const contactParts = [];
  if (lead.email) contactParts.push(`Email: ${lead.email}`);
  if (lead.phone) contactParts.push(`Phone: ${lead.phone}`);
  if (lead.linkedin_url) contactParts.push(`LinkedIn: ${lead.linkedin_url}`);
  if (lead.location) contactParts.push(`Location: ${lead.location}`);
  detailContact.textContent = contactParts.join(' · ') || 'Contact info missing';
  detailWhy.textContent = formatString(lead.why_this_lead, 'No summary yet.');
  detailAngle.textContent = formatString(lead.angle_summary, 'Angle needed');
  detailHooks.textContent = formatString(lead.personalization_hooks, 'No hooks defined');
  const detailNext = nextActionMap.get(lead.id);
  if (detailNext) {
    detailNextAction.textContent = `${detailNext.title} · due ${detailNext.due_at ? new Date(detailNext.due_at).toLocaleDateString() : 'TBD'}`;
    detailNextButton.disabled = false;
    detailNextButton.onclick = async () => {
      await completeTask(detailNext.id);
      await loadQueue();
    };
  } else {
    detailNextAction.textContent = 'No next action yet.';
    detailNextButton.disabled = true;
  }
  await renderTaskList(lead.id);
  await renderPlaybook(lead.id);
  await renderNotes(lead.id);
}

async function renderTaskList(leadId) {
  const tasks = await fetchTasksForLead(leadId);
  taskList.innerHTML = '';
  if (!tasks.length) {
    taskList.innerHTML = '<p class="muted">No tasks yet for this lead.</p>';
    return;
  }
  tasks.forEach(task => {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
      <strong>${formatString(task.title)}</strong>
      <p>Status: ${formatString(task.status)}</p>
      <p class="muted">${task.due_at ? 'Due ' + new Date(task.due_at).toLocaleDateString() : 'No due date'}</p>
    `;
    taskList.appendChild(row);
  });
}

async function renderPlaybook(leadId) {
  const steps = await fetchLeadPlaybookSteps(leadId);
  playbookList.innerHTML = '';
  if (!steps.length) {
    playbookList.innerHTML = '<p class="muted">No playbook steps yet.</p>';
    return;
  }
  steps.forEach(step => {
    const card = document.createElement('div');
    card.className = 'playbook-card';
    card.innerHTML = `<h4>${formatString(step.template_step?.step_label, 'Step')}</h4><p>${formatString(step.template_step?.action, 'Action TBD')}</p><small>${formatString(step.status)}</small>`;
    playbookList.appendChild(card);
  });
}

async function renderNotes(leadId) {
  const notes = await fetchLeadNotes(leadId);
  notesContainer.innerHTML = '';
  if (!notes.length) {
    notesContainer.textContent = 'No notes yet.';
    return;
  }
  notes.forEach(note => {
    const div = document.createElement('div');
    div.className = 'task-row';
    div.innerHTML = `<p>${note.body}</p><small>Type: ${formatString(note.note_type)} · ${new Date(note.created_at).toLocaleString()}</small>`;
    notesContainer.appendChild(div);
  });
}

statusFilter.addEventListener('change', loadQueue);
priorityFilter.addEventListener('change', loadQueue);
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadQueue, 200);
});

loadQueue();

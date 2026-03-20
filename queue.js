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
const dossierContainer = document.getElementById('detail-dossier');
const detailLinks = document.getElementById('detail-links');

let allLeads = [];
let allPlaybookSteps = [];
let playbookByLead = new Map();
let nextActionMap = new Map();
let currentLeadId = null;
let currentLeadRecord = null;
let searchTimeout;

function normalizeKey(value) {
  return normalizeLeadName(value);
}

function indexPlaybookSteps() {
  playbookByLead = new Map();
  allPlaybookSteps.forEach(step => {
    const key = normalizeKey(step.lead_name);
    if (!playbookByLead.has(key)) playbookByLead.set(key, []);
    playbookByLead.get(key).push(step);
  });
}

function getStepsForLead(lead) {
  if (!lead) return [];
  const key = normalizeKey(lead.full_name || lead.name);
  const steps = playbookByLead.get(key) || [];
  return prepareLeadSteps(lead, steps);
}

function buildNextActionMap(leads) {
  const map = new Map();
  leads.forEach(lead => {
    const steps = getStepsForLead(lead);
    const nextStep = steps.find(step => getStoredStepStatus(lead.id, step.id) !== 'done');
    if (nextStep) {
      map.set(lead.id, {
        step: nextStep,
        title: `${nextStep.step_label}. ${nextStep.action}`,
        due_at: computeDueDateForStep(lead, nextStep)
      });
    }
  });
  return map;
}

function formatString(value, fallback = '—') {
  if (value === null || value === undefined || value === 'undefined') return fallback;
  if (typeof value === 'string' && !value.trim()) return fallback;
  return value;
}

function renderTable(leads) {
  queueBody.innerHTML = '';
  if (!leads.length) {
    queueBody.innerHTML = '<tr><td colspan="6" class="muted">No leads match these filters.</td></tr>';
    return;
  }
  leads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.dataset.leadId = lead.id;
    const nextAction = nextActionMap.get(lead.id);
    tr.innerHTML = `
      <td>${formatString(lead.full_name, 'Name unknown')}</td>
      <td>${formatString(lead.company, 'Company n/a')}</td>
      <td>${formatString(lead.title, 'Title n/a')}</td>
      <td>${formatString(lead.status)}</td>
      <td>${formatString(lead.priority)}</td>
      <td>${nextAction ? `${nextAction.title}${nextAction.due_at ? ' · due ' + nextAction.due_at.toLocaleDateString() : ''}` : 'No action yet'}</td>
    `;
    tr.addEventListener('click', () => {
      selectLead(lead);
      window.open(`profile.html?lead_id=${lead.id}`, 'lead-profile');
    });
    queueBody.appendChild(tr);
  });
  highlightSelectedRow();
}

function highlightSelectedRow() {
  document.querySelectorAll('#queue-body tr').forEach(row => {
    row.classList.toggle('selected', row.dataset.leadId === currentLeadId);
  });
}

function updateDetailPanel(lead) {
  if (!lead) {
    detailName.textContent = 'Select a lead';
    detailCompany.textContent = '—';
    detailTitle.textContent = '—';
    detailContact.textContent = '—';
    detailWhy.textContent = '—';
    detailAngle.textContent = '—';
    detailHooks.textContent = '—';
    detailNextAction.textContent = 'Select a lead to load the next step.';
    detailNextButton.disabled = true;
    taskList.innerHTML = '<p class="muted">Select a lead to see tasks.</p>';
    playbookList.innerHTML = '<p class="muted">Select a lead to see playbook steps.</p>';
    notesContainer.textContent = 'Notes will appear here.';
    return;
  }
  detailName.textContent = formatString(lead.full_name, 'Name missing');
  detailCompany.textContent = formatString(lead.company, 'Company unknown');
  detailTitle.textContent = formatString(lead.title, 'Title unknown');
  const contactParts = [];
  if (lead.email) contactParts.push(`Email: ${lead.email}`);
  if (lead.phone) contactParts.push(`Phone: ${lead.phone}`);
  if (lead.linkedin_url) contactParts.push('LinkedIn profile');
  if (lead.location) contactParts.push(lead.location);
  detailContact.textContent = contactParts.join(' · ') || 'No contact info yet. Use dossier + sheet links.';
  detailWhy.textContent = formatString(lead.why_this_lead, 'Fill in why this lead matters.');
  detailAngle.textContent = formatString(lead.angle_summary, 'Specify the outreach angle.');
  detailHooks.textContent = formatString(lead.personalization_hooks, 'Add personalization hooks.');
  const nextAction = nextActionMap.get(lead.id);
  if (nextAction) {
    detailNextAction.textContent = `${nextAction.title}${nextAction.due_at ? ' · due ' + nextAction.due_at.toLocaleDateString() : ''}`;
    detailNextButton.disabled = false;
    detailNextButton.onclick = () => {
      setStoredStepStatus(lead.id, nextAction.step.id, 'done');
      refreshAfterStatusChange(lead);
    };
  } else {
    detailNextAction.textContent = 'All steps complete. Move to the next lead.';
    detailNextButton.disabled = true;
  }
  renderTaskList(lead);
  renderPlaybook(lead);
  renderNotes(lead.id);
  renderDossier(lead);
  renderLinkChips(lead);
}

function refreshAfterStatusChange(lead) {
  nextActionMap = buildNextActionMap(allLeads);
  const visibleLeads = filterLeads(allLeads);
  renderTable(visibleLeads);
  const updatedLead = allLeads.find(item => item.id === lead.id) || lead;
  currentLeadRecord = updatedLead;
  updateDetailPanel(updatedLead);
}

async function renderNotes(leadId) {
  const remoteNotes = await fetchLeadNotes(leadId);
  const localNotes = getStoredNotes(leadId).map(entry => ({ ...entry, source: 'local' }));
  const merged = [...localNotes, ...remoteNotes.map(n => ({ ...n, source: 'remote' }))];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  notesContainer.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'note-form';
  form.innerHTML = `
    <textarea placeholder="Log a quick note"></textarea>
    <button type="submit" class="pill-button">Add note</button>
  `;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    const value = textarea.value.trim();
    if (!value) return;
    addStoredNote(leadId, value);
    textarea.value = '';
    renderNotes(leadId);
  });
  notesContainer.appendChild(form);
  const list = document.createElement('div');
  if (!merged.length) {
    list.innerHTML = '<p class="muted">No notes yet.</p>';
  } else {
    merged.forEach(note => {
      const div = document.createElement('div');
      div.className = 'note-item';
      div.innerHTML = `<p>${note.body}</p><small>${new Date(note.created_at).toLocaleString()}</small>`;
      list.appendChild(div);
    });
  }
  notesContainer.appendChild(list);
}

function renderLinkChips(lead) {
  if (!detailLinks) return;
  const links = [];
  if (lead.email) links.push({ label: 'Email', href: `mailto:${lead.email}` });
  if (lead.phone) links.push({ label: 'Call', href: `tel:${lead.phone}` });
  if (lead.linkedin_url) links.push({ label: 'LinkedIn', href: normalizeLink(lead.linkedin_url) });
  if (lead.company_website) links.push({ label: 'Website', href: normalizeLink(lead.company_website) });
  if (lead.lead_sheet_link) links.push({ label: 'Lead sheet', href: lead.lead_sheet_link });
  if (lead.doc_link) links.push({ label: 'Lead doc', href: lead.doc_link });
  const dossier = getDossierForLead(lead);
  if (dossier?.docLink) links.push({ label: 'Dossier doc', href: dossier.docLink });
  if (!links.length) {
    detailLinks.innerHTML = '<p class=\"muted\">No links stored.</p>';
    return;
  }
  detailLinks.innerHTML = links.map(link => `<a class=\"link-chip\" href=\"${link.href}\" target=\"_blank\">${link.label}</a>`).join('');
}

function renderTaskList(lead) {
  const steps = getStepsForLead(lead);
  taskList.innerHTML = '';
  if (!steps.length) {
    taskList.innerHTML = '<p class="muted">No tasks available for this lead.</p>';
    return;
  }
  steps.forEach(step => {
    const status = getStoredStepStatus(lead.id, step.id);
    const row = document.createElement('div');
    row.className = `task-row ${status === 'done' ? 'task-row-done' : ''}`;
    row.innerHTML = `
      <div>
        <strong>${step.step_label}. ${step.action}</strong>
        <p class="muted">${step.medium}</p>
      </div>
    `;
    const button = document.createElement('button');
    button.className = 'pill-button';
    button.textContent = status === 'done' ? 'Undo' : 'Mark done';
    button.addEventListener('click', () => {
      const nextStatus = status === 'done' ? 'pending' : 'done';
      setStoredStepStatus(lead.id, step.id, nextStatus);
      refreshAfterStatusChange(lead);
    });
    row.appendChild(button);
    taskList.appendChild(row);
  });
}

function renderDossier(lead) {
  if (!dossierContainer) return;
  const dossier = getDossierForLead(lead);
  if (!dossier) {
    dossierContainer.innerHTML = '<p class=\"muted\">No dossier stored yet.</p>';
    return;
  }
  let html = markdownToHtml(dossier.content);
  if (dossier.docLink) {
    html += `
      <div class=\"dossier-link\">
        <a href=\"${dossier.docLink}\" target=\"_blank\">Open Google Doc</a>
      </div>
    `;
  }
  dossierContainer.innerHTML = html;
}

function renderPlaybook(lead) {
  const steps = getStepsForLead(lead);
  playbookList.innerHTML = '';
  if (!steps.length) {
    playbookList.innerHTML = '<p class="muted">No playbook steps configured.</p>';
    return;
  }
  steps.forEach(step => {
    const status = getStoredStepStatus(lead.id, step.id);
    const card = document.createElement('div');
    card.className = `playbook-card ${status === 'done' ? 'playbook-card-complete' : ''}`;
    card.innerHTML = `
      <h4>${step.step_label}. ${step.action}</h4>
      <p><strong>Medium:</strong> ${step.medium || '—'}</p>
      <p>${step.message || step.notes || 'Follow the client playbook.'}</p>
    `;
    playbookList.appendChild(card);
  });
}

function filterLeads(leads) {
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  const search = searchInput.value.toLowerCase().trim();
  return leads.filter(lead => {
    if (status && lead.status !== status) return false;
    if (priority && lead.priority !== priority) return false;
    if (search) {
      const haystack = `${lead.full_name} ${lead.company} ${lead.offer || ''} ${lead.angle_summary || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

async function loadQueue() {
  try {
    const [_, leads, playbook] = await Promise.all([fetchDossiers(), fetchLeads(), fetchPlaybookSteps()]);
    allLeads = leads.filter(Boolean);
    allPlaybookSteps = playbook;
    indexPlaybookSteps();
    nextActionMap = buildNextActionMap(allLeads);
    const visibleLeads = filterLeads(allLeads);
    renderTable(visibleLeads);
    if (!currentLeadId && visibleLeads.length) {
      selectLead(visibleLeads[0]);
    } else if (currentLeadId) {
      const existing = allLeads.find(lead => lead.id === currentLeadId);
      if (existing) selectLead(existing);
    }
  } catch (error) {
    console.error('Queue load failed', error);
    queueBody.innerHTML = `<tr><td colspan="6">Unable to load queue: ${error.message}</td></tr>`;
  }
}

function selectLead(lead) {
  if (!lead) return;
  currentLeadId = lead.id;
  currentLeadRecord = lead;
  highlightSelectedRow();
  updateDetailPanel(lead);
}

statusFilter.addEventListener('change', () => {
  const visible = filterLeads(allLeads);
  nextActionMap = buildNextActionMap(allLeads);
  renderTable(visible);
});

priorityFilter.addEventListener('change', () => {
  const visible = filterLeads(allLeads);
  nextActionMap = buildNextActionMap(allLeads);
  renderTable(visible);
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const visible = filterLeads(allLeads);
    nextActionMap = buildNextActionMap(allLeads);
    renderTable(visible);
  }, 200);
});

loadQueue();

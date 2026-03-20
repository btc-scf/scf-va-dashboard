const params = new URLSearchParams(window.location.search);
const leadId = params.get('lead_id');
const dossierEl = document.getElementById('profile-dossier');

function formatString(value, fallback = '—') {
  if (value === null || value === undefined || value === 'undefined') return fallback;
  if (typeof value === 'string' && !value.trim()) return fallback;
  return value;
}

function setStatusChip(text, priority) {
  const chip = document.getElementById('profile-status');
  chip.textContent = text;
  chip.className = 'profile-status';
  if (priority === 'high') chip.classList.add('priority-high');
  if (priority === 'urgent') chip.classList.add('priority-urgent');
}

function renderDossierSection(lead) {
  if (!dossierEl) return;
  const dossier = getDossierForLead(lead);
  if (!dossier) {
    dossierEl.innerHTML = '<p class=\"muted\">No dossier stored yet.</p>';
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
  dossierEl.innerHTML = html;
}

function renderPlaybookSteps(lead, steps) {
  const container = document.getElementById('profile-playbook');
  container.innerHTML = '';
  if (!steps.length) {
    container.innerHTML = '<p class="muted">No playbook steps attached.</p>';
    return;
  }
  steps.forEach(step => {
    const status = getStoredStepStatus(lead.id, step.id);
    const card = document.createElement('div');
    card.className = `playbook-card ${status === 'done' ? 'playbook-card-complete' : ''}`;
    card.innerHTML = `
      <h3>${step.step_label}. ${step.action}</h3>
      <p><strong>Medium:</strong> ${step.medium || '—'}</p>
      <p>${step.message || step.notes || 'Follow the playbook instructions above.'}</p>
      <small>Status: ${status}</small>
    `;
    container.appendChild(card);
  });
}

function renderTasks(lead, steps) {
  const container = document.getElementById('profile-tasks');
  container.innerHTML = '';
  if (!steps.length) {
    container.innerHTML = '<p class="muted">No tasks created yet.</p>';
    return;
  }
  steps.forEach(step => {
    const status = getStoredStepStatus(lead.id, step.id);
    const row = document.createElement('div');
    row.className = `task-row ${status === 'done' ? 'task-row-done' : ''}`;
    row.innerHTML = `
      <h3>${step.step_label}. ${step.action}</h3>
      <p>${step.medium || '—'}</p>
      <small>Status: ${status}</small>
    `;
    const button = document.createElement('button');
    button.className = 'pill-button';
    button.textContent = status === 'done' ? 'Undo' : 'Mark done';
    button.addEventListener('click', () => {
      const nextStatus = status === 'done' ? 'pending' : 'done';
      setStoredStepStatus(lead.id, step.id, nextStatus);
      renderTasks(lead, steps);
      renderPlaybookSteps(lead, steps);
      renderNextAction(lead, steps);
    });
    row.appendChild(button);
    container.appendChild(row);
  });
}

function renderNextAction(lead, steps) {
  const next = steps.find(step => getStoredStepStatus(lead.id, step.id) !== 'done');
  const nextBlock = document.getElementById('profile-next-action');
  if (!next) {
    nextBlock.textContent = 'All actions complete—move to the next lead.';
    return;
  }
  const due = computeDueDateForStep(lead, next);
  nextBlock.textContent = `${next.step_label}. ${next.action}${due ? ' · due ' + due.toLocaleDateString() : ''}`;
}

async function initProfile() {
  if (!leadId) {
    document.getElementById('profile-name').textContent = 'No lead selected';
    document.getElementById('profile-why').textContent = 'Pass ?lead_id= to load a profile.';
    return;
  }
  const lead = await fetchLeadById(leadId);
  if (!lead) return;
  document.getElementById('profile-name').textContent = lead.full_name;
  document.getElementById('profile-company').textContent = `${formatString(lead.title, 'Coach')} · ${formatString(lead.company, 'Independent')}`;
  setStatusChip(lead.status || 'Unknown', lead.priority);
  document.getElementById('profile-why').textContent = lead.why_this_lead || '—';
  document.getElementById('profile-angle').textContent = lead.angle_summary || '—';
  document.getElementById('profile-hooks').textContent = lead.personalization_hooks || '—';
  const [_, playbookSteps] = await Promise.all([
    fetchDossiers(),
    fetchLeadPlaybookSteps(lead.full_name || lead.name)
  ]);
  const steps = prepareLeadSteps(lead, playbookSteps);
  renderNextAction(lead, steps);
  renderTasks(lead, steps);
  renderPlaybookSteps(lead, steps);
  renderDossierSection(lead);
}

initProfile();

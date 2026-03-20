const params = new URLSearchParams(window.location.search);
const leadId = params.get('lead_id');
const dossierEl = document.getElementById('profile-dossier');
const profileLinks = document.getElementById('profile-links');
const profileNotes = document.getElementById('profile-notes');

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

async function renderProfileNotes(lead) {
  if (!profileNotes) return;
  const remoteNotes = await fetchLeadNotes(lead.id);
  const localNotes = getStoredNotes(lead.id).map(entry => ({ ...entry, source: 'local' }));
  const merged = [...localNotes, ...remoteNotes.map(n => ({ ...n, source: 'remote' }))];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  profileNotes.innerHTML = '';
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
    addStoredNote(lead.id, value);
    textarea.value = '';
    renderProfileNotes(lead);
  });
  profileNotes.appendChild(form);
  const list = document.createElement('div');
  if (!merged.length) {
    list.innerHTML = '<p class="muted">No notes yet.</p>';
  } else {
    merged.forEach(note => {
      const div = document.createElement('div');
      div.className = 'note-item';
      const content = document.createElement('div');
      content.innerHTML = `<p>${note.body}</p><small>${new Date(note.created_at).toLocaleString()}</small>`;
      div.appendChild(content);
      if (note.source === 'local') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pill-button note-delete';
        button.textContent = 'Delete';
        button.addEventListener('click', () => {
          deleteStoredNote(lead.id, note.created_at);
          renderProfileNotes(lead);
        });
        div.appendChild(button);
      }
      list.appendChild(div);
    });
  }
  profileNotes.appendChild(list);
}

function renderProfileLinks(lead) {
  if (!profileLinks) return;
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
    profileLinks.innerHTML = '<p class=\"muted\">No links stored.</p>';
    return;
  }
  profileLinks.innerHTML = links.map(link => `<a class=\"link-chip\" href=\"${link.href}\" target=\"_blank\">${link.label}</a>`).join('');
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
  renderProfileLinks(lead);
  renderProfileNotes(lead);
}

initProfile();

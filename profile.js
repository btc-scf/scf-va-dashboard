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
  const seen = new Set();
  const addLink = (label, href) => {
    if (!href) return;
    const key = `${label}-${href}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, href });
  };
  if (lead.email) addLink('Email', `mailto:${lead.email}`);
  if (lead.phone) addLink('Call', `tel:${lead.phone}`);
  if (lead.linkedin_url) addLink('LinkedIn', normalizeLink(lead.linkedin_url));
  if (lead.company_website) addLink('Website', normalizeLink(lead.company_website));
  if (lead.lead_sheet_link) addLink('Lead sheet', lead.lead_sheet_link);
  if (lead.doc_link) addLink('Lead doc', lead.doc_link);
  const dossier = getDossierForLead(lead);
  if (dossier?.docLink) addLink('Dossier doc', dossier.docLink);
  if (dossier?.contact) {
    const contact = dossier.contact;
    contact.emails?.forEach(email => addLink('Email', `mailto:${email}`));
    contact.phones?.forEach(phone => addLink('Call', `tel:${phone}`));
    contact.links?.forEach(item => addLink(item.label || 'Link', item.url));
  }
  if (!links.length) {
    profileLinks.innerHTML = '<p class="muted">No links stored.</p>';
    return;
  }
  profileLinks.innerHTML = links.map(link => `<a class="link-chip" href="${link.href}" target="_blank">${link.label}</a>`).join('');
}

async function initProfile() {
  const nameEl = document.getElementById('profile-name');
  const whyEl = document.getElementById('profile-why');
  if (!leadId) {
    if (nameEl) nameEl.textContent = 'No lead selected';
    if (whyEl) whyEl.textContent = 'Pass ?lead_id= to load a profile.';
    return;
  }
  try {
    const lead = await fetchLeadById(leadId);
    if (!lead) {
      if (nameEl) nameEl.textContent = 'Lead not found';
      if (whyEl) whyEl.textContent = 'Reopen the profile from the lead queue.';
      return;
    }
    nameEl.textContent = lead.full_name;
    document.getElementById('profile-company').textContent = `${formatString(lead.title, 'Coach')} · ${formatString(lead.company, 'Independent')}`;
    setStatusChip(lead.status || 'Unknown', lead.priority);
    if (whyEl) whyEl.textContent = lead.why_this_lead || '—';
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
  } catch (error) {
    console.error('Failed to load profile', error);
    if (nameEl) nameEl.textContent = 'Error loading profile';
    if (whyEl) whyEl.textContent = 'Please refresh or reopen from the lead queue.';
  }
}

initProfile();

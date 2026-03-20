const params = new URLSearchParams(window.location.search);
const leadId = params.get('lead_id');

function setStatusChip(text, priority) {
  const chip = document.getElementById('profile-status');
  chip.textContent = text;
  chip.className = 'profile-status';
  if (priority === 'high') chip.classList.add('priority-high');
  if (priority === 'urgent') chip.classList.add('priority-urgent');
}

function renderPlaybookSteps(steps) {
  const container = document.getElementById('profile-playbook');
  container.innerHTML = '';
  if (!steps.length) {
    container.innerHTML = '<p class="muted">No playbook steps attached.</p>';
    return;
  }
  steps.forEach(step => {
    const card = document.createElement('div');
    card.className = 'playbook-card';
    card.innerHTML = `
      <h3>${step.template_step?.step_label || 'Untitled step'}</h3>
      <p><strong>Action:</strong> ${step.template_step?.action || step.result || '—'}</p>
      <small>${step.status}</small>
      <p>${step.notes || 'No notes yet.'}</p>
    `;
    container.appendChild(card);
  });
}

function renderTasks(tasks) {
  const container = document.getElementById('profile-tasks');
  container.innerHTML = '';
  if (!tasks.length) {
    container.innerHTML = '<p class="muted">No tasks created yet.</p>';
    return;
  }
  tasks.forEach(task => {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description || 'No details yet.'}</p>
      <small>Status: ${task.status} · Priority: ${task.priority} · Due: ${task.due_at ? new Date(task.due_at).toLocaleDateString() : '—'}</small>
    `;
    container.appendChild(row);
  });
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
  setStatusChip(lead.status || 'Unknown', lead.priority);
  document.getElementById('profile-why').textContent = lead.why_this_lead || '—';
  document.getElementById('profile-angle').textContent = lead.angle_summary || '—';
  document.getElementById('profile-hooks').textContent = lead.personalization_hooks || '—';
  const tasks = await fetchTasksForLead(leadId);
  renderTasks(tasks);
  const steps = await fetchLeadPlaybookSteps(leadId);
  renderPlaybookSteps(steps);
}

initProfile();

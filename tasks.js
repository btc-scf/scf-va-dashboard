const columnIds = ['todo', 'in_progress', 'waiting', 'blocked', 'done'];
const columns = columnIds.reduce((acc, key) => {
  acc[key] = document.getElementById(`column-${key}`);
  return acc;
}, {});

let leadsCache = [];
let playbookCache = [];
let playbookByLeadName = new Map();

function normalizeKey(value) {
  return normalizeLeadName(value);
}

function indexPlaybookCache() {
  playbookByLeadName = new Map();
  playbookCache.forEach(step => {
    const key = normalizeKey(step.lead_name);
    if (!playbookByLeadName.has(key)) playbookByLeadName.set(key, []);
    playbookByLeadName.get(key).push(step);
  });
}

function getStepsForLead(lead) {
  const key = normalizeKey(lead.full_name || lead.name);
  const steps = playbookByLeadName.get(key) || [];
  return prepareLeadSteps(lead, steps);
}

function determineColumn(lead, step, status, steps) {
  if (status === 'done') return 'done';
  const orderValue = stepOrderValue(step.step_label);
  const priorSteps = steps.filter(other => stepOrderValue(other.step_label) < orderValue);
  const priorComplete = priorSteps.every(other => getStoredStepStatus(lead.id, other.id) === 'done');
  if (!priorSteps.length) return 'todo';
  return priorComplete ? 'in_progress' : 'waiting';
}

function renderBoard() {
  columnIds.forEach(key => {
    columns[key].innerHTML = '';
  });
  leadsCache.forEach(lead => {
    const steps = getStepsForLead(lead);
    steps.forEach(step => {
      const status = getStoredStepStatus(lead.id, step.id);
      const bucket = determineColumn(lead, step, status, steps);
      const card = document.createElement('article');
      card.className = `notion-card ${status === 'done' ? 'task-row-done' : ''}`;
      card.innerHTML = `
        <header>
          <span>${lead.full_name}</span>
          <strong>${step.step_label}</strong>
        </header>
        <p>${step.action}</p>
        <small>${step.medium || '—'}</small>
      `;
      const button = document.createElement('button');
      button.className = 'pill-button';
      button.textContent = status === 'done' ? 'Undo' : 'Mark done';
      button.addEventListener('click', () => {
        const nextStatus = status === 'done' ? 'pending' : 'done';
        setStoredStepStatus(lead.id, step.id, nextStatus);
        renderBoard();
      });
      card.appendChild(button);
      columns[bucket].appendChild(card);
    });
  });
  columnIds.forEach(key => {
    if (!columns[key].children.length) {
      columns[key].innerHTML = '<p class="muted">No tasks here yet.</p>';
    }
  });
}

async function loadTasksView() {
  try {
    const [leads, playbook] = await Promise.all([fetchLeads(), fetchPlaybookSteps()]);
    leadsCache = leads.filter(Boolean);
    playbookCache = playbook;
    indexPlaybookCache();
    renderBoard();
  } catch (error) {
    columnIds.forEach(key => {
      columns[key].innerHTML = `<p class="muted">Unable to load tasks: ${error.message}</p>`;
    });
  }
}

loadTasksView();

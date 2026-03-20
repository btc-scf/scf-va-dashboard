const cardsContainer = document.getElementById('task-cards');
const overdueToggle = document.getElementById('overdue-toggle');

if (window.location.hash === '#overdue' && overdueToggle) {
  overdueToggle.checked = true;
}

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

function isOverdue(lead, step) {
  const due = computeDueDateForStep(lead, step);
  if (!due) return false;
  return due < new Date() && getStoredStepStatus(lead.id, step.id) !== 'done';
}

function buildCards() {
  const showOverdueOnly = overdueToggle?.checked || window.location.hash === '#overdue';
  const cards = [];
  leadsCache.forEach(lead => {
    const steps = getStepsForLead(lead);
    const nextStep = steps.find(step => getStoredStepStatus(lead.id, step.id) !== 'done');
    const overdue = nextStep ? isOverdue(lead, nextStep) : false;
    if (showOverdueOnly && !overdue) return;
    cards.push({ lead, steps, nextStep, overdue });
  });
  cards.sort((a, b) => {
    if (a.overdue === b.overdue) return (a.nextStep ? stepOrderValue(a.nextStep.step_label) : 999) - (b.nextStep ? stepOrderValue(b.nextStep.step_label) : 999);
    return a.overdue ? -1 : 1;
  });
  renderCards(cards);
}

function renderCards(cards) {
  cardsContainer.innerHTML = '';
  if (!cards.length) {
    cardsContainer.innerHTML = '<p class="muted">No tasks to show.</p>';
    return;
  }
  cards.forEach(({ lead, steps, nextStep, overdue }) => {
    const status = nextStep ? getStoredStepStatus(lead.id, nextStep.id) : 'done';
    const due = nextStep ? computeDueDateForStep(lead, nextStep) : null;
    const card = document.createElement('article');
    card.className = `task-card-entry ${overdue ? 'task-card-overdue' : ''}`;
    card.innerHTML = `
      <header>
        <div>
          <h3>${lead.full_name}</h3>
          <p class="muted">${lead.company}</p>
        </div>
        <span class="status-pill">${lead.status}</span>
      </header>
      <div class="task-card-body">
        <p class="task-label">Next action</p>
        <strong>${nextStep ? `${nextStep.step_label}. ${nextStep.action}` : 'All steps complete'}</strong>
        <p class="muted">${due ? `Due ${due.toLocaleDateString()}` : ''}</p>
      </div>
      <div class="task-card-actions">
        <button class="pill-button" data-action="toggle" ${nextStep ? '' : 'disabled'}>${status === 'done' ? 'Undo' : 'Mark done'}</button>
        <a class="pill-button" href="profile.html?lead_id=${lead.id}" target="_blank">Open profile</a>
      </div>
      <details>
        <summary>View playbook steps</summary>
        <ul class="task-step-list">
          ${steps.map(step => {
            const stepStatus = getStoredStepStatus(lead.id, step.id);
            return `<li class="${stepStatus === 'done' ? 'step-done' : ''}"><span>${step.step_label}.</span> ${step.action}</li>`;
          }).join('')}
        </ul>
      </details>
    `;
    const toggleButton = card.querySelector('button[data-action="toggle"]');
    if (toggleButton && nextStep) {
      toggleButton.addEventListener('click', () => {
        const nextStatus = status === 'done' ? 'pending' : 'done';
        setStoredStepStatus(lead.id, nextStep.id, nextStatus);
        buildCards();
      });
    }
    cardsContainer.appendChild(card);
  });
}

async function loadTasksView() {
  try {
    const [_, leads, playbook] = await Promise.all([fetchDossiers(), fetchLeads(), fetchPlaybookSteps()]);
    leadsCache = leads.filter(Boolean);
    playbookCache = playbook;
    indexPlaybookCache();
    buildCards();
  } catch (error) {
    cardsContainer.innerHTML = `<p class="muted">Unable to load tasks: ${error.message}</p>`;
  }
}

overdueToggle?.addEventListener('change', buildCards);

loadTasksView();

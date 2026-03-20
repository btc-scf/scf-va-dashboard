const clientCards = document.getElementById('client-cards');

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

function computeClientStats(client) {
  const clientLeads = leadsCache.filter(lead => (lead.client_name || 'SimpleCoachFunnel') === client.name);
  const totalLeads = clientLeads.length;
  const statusCounts = clientLeads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});
  const overdueLeads = clientLeads.filter(lead => {
    const steps = getStepsForLead(lead);
    const next = steps.find(step => getStoredStepStatus(lead.id, step.id) !== 'done');
    return next ? isOverdue(lead, next) : false;
  }).length;
  return { clientLeads, totalLeads, statusCounts, overdueLeads };
}

function isOverdue(lead, step) {
  const due = computeDueDateForStep(lead, step);
  if (!due) return false;
  return due < new Date() && getStoredStepStatus(lead.id, step.id) !== 'done';
}

function renderClients(clients) {
  clientCards.innerHTML = '';
  clients.forEach(client => {
    const stats = computeClientStats(client);
    const card = document.createElement('article');
    card.className = 'client-card';
    card.innerHTML = `
      <header>
        <h3>${client.name}</h3>
        <p class="muted">${client.offer}</p>
      </header>
      <div class="client-meta">
        <p><strong>ICP:</strong> ${client.target_icp}</p>
        <p><strong>Funnel:</strong> ${client.funnel_type}</p>
        <p><strong>Outreach notes:</strong> ${client.outreach_notes}</p>
      </div>
      <div class="client-stats">
        <div>
          <span>${stats.totalLeads}</span>
          <p>Total leads</p>
        </div>
        <div>
          <span>${stats.overdueLeads}</span>
          <p>Overdue</p>
        </div>
        <div>
          <span>${stats.statusCounts.ready_for_outreach || 0}</span>
          <p>Ready for outreach</p>
        </div>
      </div>
      <div class="client-actions">
        <a class="pill-button" href="index.html" target="_blank">Open lead queue</a>
      </div>
    `;
    clientCards.appendChild(card);
  });
}

async function loadClientsView() {
  try {
    const [clients, leads, playbook] = await Promise.all([
      fetch('data/clients.json').then(res => res.json()),
      fetchLeads(),
      fetchPlaybookSteps()
    ]);
    leadsCache = leads.filter(Boolean);
    playbookCache = playbook;
    indexPlaybookCache();
    renderClients(clients);
  } catch (error) {
    clientCards.innerHTML = `<p class="muted">Unable to load clients: ${error.message}</p>`;
  }
}

loadClientsView();

const statusFilter = document.getElementById('filter-status');
const priorityFilter = document.getElementById('filter-priority');
const searchInput = document.getElementById('filter-search');
const tableBody = document.getElementById('leads-body');

async function loadLeads() {
  const filters = {
    status: statusFilter.value,
    priority: priorityFilter.value
  };
  const leads = await fetchLeads(filters);
  const search = searchInput.value.toLowerCase();
  const filtered = leads.filter(lead => {
    if (!search) return true;
    return [lead.Client, lead.Offer, lead.Funnel, lead.Notes].some(value =>
      value && value.toLowerCase().includes(search)
    );
  });
  renderTable(filtered);
}

function renderTable(leads) {
  tableBody.innerHTML = '';
  if (!leads.length) {
    tableBody.innerHTML = '<tr><td colspan="6" class="muted">No leads match the filters.</td></tr>';
    return;
  }
  leads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${lead.Client}</td>
      <td>${lead.Offer}</td>
      <td>${lead['Link to lead sheet'] ? 'Ready' : 'New'}</td>
      <td>${lead.Priority || 'medium'}</td>
      <td>${lead['VA Task']?.slice(0, 60) ?? '—'}</td>
      <td>${lead.Owner || 'VA'}</td>
    `;
    tr.addEventListener('click', () => {
      window.location.href = `profile.html?lead_id=${lead.id || ''}`;
    });
    tableBody.appendChild(tr);
  });
}

statusFilter.addEventListener('change', loadLeads);
priorityFilter.addEventListener('change', loadLeads);
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadLeads, 200);
});

loadLeads();

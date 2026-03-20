const dataUrl = 'data/client-outreach-plan.json';

function parseHyperlink(value) {
  if (!value) return null;
  const match = value.match(/HYPERLINK\("([^"]+)"(?:,"([^"]+)")?\)/i);
  if (!match) return null;
  return { href: match[1], label: match[2] || 'Link' };
}

function updateSummary(data) {
  const total = data.length;
  const linked = data.filter(row => row['Link to lead sheet']).length;
  document.getElementById('total-leads').textContent = total;
  document.getElementById('linked-leads').textContent = linked;
}

function renderTable(data) {
  const tbody = document.querySelector('#lead-table tbody');
  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');

    const clientCell = document.createElement('td');
    clientCell.textContent = row['Client'];
    tr.appendChild(clientCell);

    const offerCell = document.createElement('td');
    offerCell.textContent = row['Offer'];
    tr.appendChild(offerCell);

    const funnelCell = document.createElement('td');
    funnelCell.textContent = row['Funnel'];
    tr.appendChild(funnelCell);

    const leadSheetCell = document.createElement('td');
    const leadSheetLink = parseHyperlink(row['Link to lead sheet']);
    if (leadSheetLink) {
      const a = document.createElement('a');
      a.href = leadSheetLink.href;
      a.textContent = leadSheetLink.label;
      a.target = '_blank';
      leadSheetCell.appendChild(a);
    } else {
      leadSheetCell.textContent = '—';
    }
    tr.appendChild(leadSheetCell);

    const docCell = document.createElement('td');
    const docLink = parseHyperlink(row['Doc Link']);
    if (docLink) {
      const a = document.createElement('a');
      a.href = docLink.href;
      a.textContent = docLink.label;
      a.target = '_blank';
      docCell.appendChild(a);
    } else {
      docCell.textContent = '—';
    }
    tr.appendChild(docCell);

    const taskCell = document.createElement('td');
    taskCell.textContent = row['VA Task'];
    tr.appendChild(taskCell);

    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetch(dataUrl)
    .then(response => response.json())
    .then(data => {
      updateSummary(data);
      renderTable(data);
    })
    .catch(error => {
      console.error('Failed to load lead data', error);
      const tbody = document.querySelector('#lead-table tbody');
      tbody.innerHTML = '<tr><td colspan="6">Unable to load lead data.</td></tr>';
    });
});

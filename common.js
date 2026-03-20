const supabaseUrl = 'https://hvouvsqxoxukgoefpuok.supabase.co/rest/v1';
const supabaseKey = 'sb_publishable_wRSdpAX-xp4kGo-ZRcOLVQ_ngaWyMVW';
const supabaseHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`
};

function hydrateLeadRow(row) {
  if (!row) return null;
  const name = row.full_name || row.name || row.Client || row.offer || 'Unnamed lead';
  const nameParts = name.trim().split(' ');
  const firstName = row.first_name || nameParts[0] || name;
  const lastName = row.last_name || nameParts.slice(1).join(' ');
  const company = row.company || row.offer || 'Independent coach';
  const hydrated = {
    ...row,
    name,
    full_name: name,
    first_name: firstName,
    last_name: lastName,
    company,
    title: row.title || row.role || 'Founder / Coach',
    status: row.status || 'new',
    priority: row.priority || 'medium'
  };
  hydrated.Client = name;
  hydrated.Priority = hydrated.priority;
  hydrated.client_name = row.client_name || 'SimpleCoachFunnel';
  return hydrated;
}

async function fetchLeads(filters = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  if (filters.status) params.set('status', `eq.${filters.status}`);
  if (filters.priority) params.set('priority', `eq.${filters.priority}`);
  const response = await fetch(`${supabaseUrl}/leads?${params.toString()}`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Failed to load leads');
  const data = await response.json();
  return data.map(hydrateLeadRow);
}

async function fetchLeadById(id) {
  const response = await fetch(`${supabaseUrl}/leads?id=eq.${id}&select=*`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Lead not found');
  const data = await response.json();
  return hydrateLeadRow(data[0]);
}

async function fetchPlaybookSteps(options = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  if (options.leadName) params.set('lead_name', `eq.${options.leadName}`);
  try {
    const response = await fetch(`${supabaseUrl}/playbook_steps?${params.toString()}`, { headers: supabaseHeaders });
    if (!response.ok) {
      console.warn('Playbook steps unavailable', response.status);
      return [];
    }
    return response.json();
  } catch (error) {
    console.warn('Playbook fetch failed', error);
    return [];
  }
}

async function fetchLeadPlaybookSteps(leadName) {
  const name = leadName || '';
  return fetchPlaybookSteps({ leadName: name });
}

async function fetchLeadNotes(leadId) {
  try {
    const response = await fetch(`${supabaseUrl}/lead_notes?lead_id=eq.${leadId}&select=*`, { headers: supabaseHeaders });
    if (!response.ok) throw new Error('Notes not available');
    return response.json();
  } catch (error) {
    console.warn('Notes unavailable', error.message);
    return [];
  }
}

const TASK_STATUS_KEY = 'scfTaskProgress';
let inMemoryTaskStore = {};

function readTaskStatusStore() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return inMemoryTaskStore;
  }
  try {
    const raw = window.localStorage.getItem(TASK_STATUS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Unable to read task status store', error);
    return {};
  }
}

function writeTaskStatusStore(store) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    inMemoryTaskStore = store;
    return;
  }
  window.localStorage.setItem(TASK_STATUS_KEY, JSON.stringify(store));
}

function getStoredStepStatus(leadId, stepId) {
  const store = readTaskStatusStore();
  return store?.[leadId]?.[stepId] || 'pending';
}

function setStoredStepStatus(leadId, stepId, status) {
  const store = readTaskStatusStore();
  if (!store[leadId]) store[leadId] = {};
  store[leadId][stepId] = status;
  writeTaskStatusStore(store);
}

function clearStoredTasksForLead(leadId) {
  const store = readTaskStatusStore();
  if (store[leadId]) {
    delete store[leadId];
    writeTaskStatusStore(store);
  }
}

const DEFAULT_TASK_BLUEPRINT = [
  {
    step_label: 'A',
    action: 'Research the lead',
    medium: 'Research',
    message: 'Open the dossier and lead sheet. Capture the offer, funnel, and any proof before outreach.'
  },
  {
    step_label: 'B',
    action: 'Determine outreach angle',
    medium: 'Strategy',
    message: 'Decide which offer promise or case study will resonate. Draft the outreach hook.'
  },
  {
    step_label: 'C',
    action: 'Send outreach email',
    medium: 'Email',
    message: 'Send the templated outreach email referencing the lead’s offer and funnel.'
  },
  {
    step_label: 'D',
    action: 'Follow-up 1',
    medium: 'Email / DM',
    message: 'Follow up with a shortened reminder and CTA to book a call.'
  },
  {
    step_label: 'E',
    action: 'Follow-up 2',
    medium: 'Email / DM',
    message: 'Final follow-up with social proof or mini audit insight to elicit a reply.'
  }
];

function normalizeLeadName(value) {
  return (value || '').trim().toLowerCase();
}

function stepOrderValue(label) {
  if (!label) return 999;
  const str = label.toString().trim().toUpperCase();
  if (str.length === 1 && str >= 'A' && str <= 'Z') {
    return str.charCodeAt(0) - 64; // A => 1
  }
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? 999 : parsed;
}

function prepareLeadSteps(lead, steps = []) {
  const working = (steps || []).map((step, index) => ({
    ...step,
    id: step.id || `${lead.id}-step-${index}`,
    step_label: step.step_label || String.fromCharCode(65 + index)
  }));
  if (!working.length) {
    return DEFAULT_TASK_BLUEPRINT.map((template, index) => ({
      id: `${lead.id}-default-${index}`,
      lead_name: lead.full_name || lead.name,
      step_label: template.step_label || String.fromCharCode(65 + index),
      action: template.action,
      medium: template.medium,
      message: template.message,
      notes: template.notes || ''
    }));
  }
  return working.sort((a, b) => stepOrderValue(a.step_label) - stepOrderValue(b.step_label));
}

function computeDueDateForStep(lead, step) {
  if (!lead?.created_at) return null;
  const created = new Date(lead.created_at);
  if (Number.isNaN(created.getTime())) return null;
  const offset = stepOrderValue(step.step_label) || 1;
  const due = new Date(created);
  due.setDate(due.getDate() + offset);
  return due;
}
let dossierCache = null;

async function fetchDossiers() {
  if (dossierCache) return dossierCache;
  try {
    const response = await fetch('data/dossiers.json');
    if (!response.ok) throw new Error('Missing dossiers dataset');
    dossierCache = await response.json();
  } catch (error) {
    console.warn('Unable to load dossiers', error.message);
    dossierCache = {};
  }
  return dossierCache;
}

function toSlug(value) {
  return (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getDossierForLead(lead) {
  if (!lead) return null;
  const slug = toSlug(lead.full_name || lead.name);
  return (dossierCache && dossierCache[slug]) ? dossierCache[slug] : null;
}

function markdownToHtml(markdownText) {
  if (!markdownText) return '';
  const lines = markdownText.split(/\n/);
  let html = '';
  let inList = false;
  lines.forEach(line => {
    if (line.startsWith('## ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h3>${line.substring(3).trim()}</h3>`;
    } else if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${line.substring(2).trim()}</li>`;
    } else if (line.trim() === '') {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${line.trim()}</p>`;
    }
  });
  if (inList) html += '</ul>';
  return html;
}

const supabaseUrl = 'https://hvouvsqxoxukgoefpuok.supabase.co/rest/v1';
const supabaseKey = 'sb_publishable_wRSdpAX-xp4kGo-ZRcOLVQ_ngaWyMVW';
const supabaseHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`
};

async function fetchLeads(filters = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  if (filters.status) params.set('status', `eq.${filters.status}`);
  if (filters.priority) params.set('priority', `eq.${filters.priority}`);
  const response = await fetch(`${supabaseUrl}/leads?${params.toString()}`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Failed to load leads');
  const data = await response.json();
  return data.map(row => ({
    ...row,
    full_name: row.full_name || row.name,
    Client: row.full_name || row.name,
    Priority: row.priority || 'medium'
  }));
}

async function fetchLeadById(id) {
  const response = await fetch(`${supabaseUrl}/leads?id=eq.${id}&select=*`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Lead not found');
  const data = await response.json();
  return data[0];
}

async function fetchTasks(filters = {}) {
  const params = new URLSearchParams();
  params.set('select', '*,lead:leads(full_name)');
  if (filters.status) params.set('status', `eq.${filters.status}`);
  if (filters.client_id) params.set('client_id', `eq.${filters.client_id}`);
  const response = await fetch(`${supabaseUrl}/tasks?${params.toString()}&order=priority.desc,due_at.asc`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Failed to load tasks');
  return response.json();
}

async function fetchTasksForLead(leadId) {
  const response = await fetch(`${supabaseUrl}/tasks?lead_id=eq.${leadId}&order=priority.desc,due_at.asc`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Failed to load lead tasks');
  return response.json();
}

async function fetchLeadPlaybookSteps(leadId) {
  const response = await fetch(`${supabaseUrl}/lead_playbook_steps?lead_id=eq.${leadId}&select=*,template_step:playbook_template_steps(step_label,action,medium,goal,step_order)&order=template_step.step_order.asc`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Failed to load playbook steps');
  return response.json();
}

async function completeTask(taskId) {
  const response = await fetch(`${supabaseUrl}/tasks?id=eq.${taskId}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'done',
      completed_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error('Failed to mark task done');
  return response.json();
}

async function fetchLeadNotes(leadId) {
  const response = await fetch(`${supabaseUrl}/lead_notes?lead_id=eq.${leadId}&select=*`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Failed to load notes');
  return response.json();
}

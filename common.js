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
    id: row.id,
    Client: row.full_name,
    Offer: row.offer,
    Funnel: row.funnel_type,
    'Link to lead sheet': row.lead_sheet_link,
    'Doc Link': row.doc_link,
    'VA Task': row.angle_summary,
    Notes: row.why_this_lead,
    Priority: row.priority,
    Owner: row.owner_user_id
  }));
}

async function fetchLeadById(id) {
  const response = await fetch(`${supabaseUrl}/leads?id=eq.${id}&select=*`, { headers: supabaseHeaders });
  if (!response.ok) throw new Error('Lead not found');
  const data = await response.json();
  return data[0];
}

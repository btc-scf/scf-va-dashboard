const statusOrder = ['todo', 'in_progress', 'waiting', 'blocked', 'done'];
const statusTitles = {
  todo: 'To Do',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  blocked: 'Blocked',
  done: 'Done'
};

function renderTaskCard(task) {
  const due = task.due_at ? new Date(task.due_at).toLocaleDateString() : 'No due date';
  const leadName = task.lead?.full_name || 'Unknown lead';
  const card = document.createElement('article');
  card.className = 'notion-card';
  if (task.priority === 'high') card.classList.add('priority-high');
  if (task.priority === 'urgent') card.classList.add('priority-urgent');
  if (task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done') {
    card.classList.add('overdue-card');
  }
  card.innerHTML = `
    <div class="card-header">
      <h3>${task.title}</h3>
      <span class="status-pill">${statusTitles[task.status] || task.status}</span>
    </div>
    <p class="card-meta">Lead: ${leadName}</p>
    <p class="card-meta">Priority: ${task.priority}</p>
    <p class="card-meta muted">Due: ${due}</p>
    <p class="card-body">${task.description || 'No description yet.'}</p>
  `;
  card.addEventListener('click', () => {
    window.location.href = `profile.html?lead_id=${task.lead_id}`;
  });
  return card;
}

async function loadTasksView() {
  const tasks = await fetchTasks();
  statusOrder.forEach(status => {
    const column = document.getElementById(`column-${status}`);
    column.innerHTML = '';
    const bucket = tasks.filter(task => task.status === status);
    if (!bucket.length) {
      column.innerHTML = '<p class="muted">No tasks in this column yet.</p>';
    } else {
      bucket.forEach(task => column.appendChild(renderTaskCard(task)));
    }
  });
}

loadTasksView();

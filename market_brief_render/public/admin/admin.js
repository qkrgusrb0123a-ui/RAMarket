(() => {
  const loginView = document.querySelector('#login-view');
  const dashboard = document.querySelector('#dashboard');
  const loginForm = document.querySelector('#login-form');
  const password = document.querySelector('#password');
  const loginError = document.querySelector('#login-error');
  const pageError = document.querySelector('#page-error');
  const pageTitle = document.querySelector('#page-title');
  const reportList = document.querySelector('#report-list');
  const empty = document.querySelector('#empty');
  const dialog = document.querySelector('#conversation-dialog');
  const conversation = document.querySelector('#conversation');
  const conversationTitle = document.querySelector('#conversation-title');
  const durationOptions = [['1d', '1일'], ['3d', '3일'], ['7d', '7일'], ['30d', '30일'], ['1y', '1년'], ['permanent', '무기한']];
  let currentView = 'product';
  let token = sessionStorage.getItem('ramarket-admin-token');

  function text(value, fallback = '삭제된 사용자') { return typeof value === 'string' && value ? value : fallback; }
  function person(value) { const user = Array.isArray(value) ? value[0] : value; return user || null; }
  function date(value) { return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  function message(error, destination) { destination.textContent = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'; }
  function suspensionText(user) { return user.suspended_until ? `해제 예정: ${date(user.suspended_until)}` : '무기한 활동 정지'; }

  async function request(path, options = {}) {
    const response = await fetch(`/api/v1/admin${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) signOut();
      throw new Error(data.error || '요청을 처리하지 못했습니다.');
    }
    return data;
  }

  function signOut() { token = null; sessionStorage.removeItem('ramarket-admin-token'); dashboard.hidden = true; loginView.hidden = false; password.value = ''; }
  function button(label, className, action) { const element = document.createElement('button'); element.textContent = label; if (className) element.className = className; element.addEventListener('click', action); return element; }
  function durationSelect() { const select = document.createElement('select'); select.setAttribute('aria-label', '활동 정지 기간'); durationOptions.forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); }); return select; }

  async function suspend(user, duration) {
    const label = durationOptions.find(([value]) => value === duration)?.[1] || duration;
    if (!confirm(`${text(user.nickname, user.login_id)} 계정을 ${label} 동안 활동 정지할까요?`)) return;
    await request(`/users/${user.id}/suspension`, { method: 'PATCH', body: JSON.stringify({ duration }) });
    await loadDashboard();
  }
  async function cancelSuspension(user) {
    if (!confirm(`${text(user.nickname, user.login_id)} 계정의 활동 정지를 취소할까요?`)) return;
    await request(`/users/${user.id}/suspension`, { method: 'DELETE' });
    await loadDashboard();
  }
  async function deleteUser(user) {
    if (!confirm(`${text(user.nickname, user.login_id)} 계정과 해당 사용자의 판매글·채팅을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    await request(`/users/${user.id}`, { method: 'DELETE' });
    await loadDashboard();
  }
  async function deleteProduct(product) {
    if (!confirm(`「${text(product.title, '판매글')}」 게시글과 연결된 채팅을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    await request(`/products/${product.id}`, { method: 'DELETE' });
    await loadDashboard();
  }
  async function showConversation(report) {
    const data = await request(`/reports/${report.id}/conversation`);
    conversationTitle.textContent = `채팅 내용 · ${text(data.data.productTitle, '삭제된 판매글')}`;
    conversation.replaceChildren();
    if (!data.data.messages.length) conversation.textContent = '남아 있는 메시지가 없습니다.';
    for (const item of data.data.messages) {
      const sender = person(item.sender);
      const box = document.createElement('div'); box.className = 'message';
      const name = document.createElement('strong'); name.textContent = text(sender?.nickname, sender?.login_id || '삭제된 사용자');
      const content = document.createElement('span'); content.textContent = item.content;
      const time = document.createElement('time'); time.textContent = date(item.created_at);
      box.append(name, content, time); conversation.append(box);
    }
    dialog.showModal();
  }
  function suspensionControls(user, actions) {
    if (user.status === 'suspended') {
      actions.append(button('활동 정지 취소', 'warning', async () => { try { await cancelSuspension(user); } catch (error) { message(error, pageError); } }));
      return;
    }
    const select = durationSelect();
    actions.append(select, button('활동 정지', 'warning', async () => { try { await suspend(user, select.value); } catch (error) { message(error, pageError); } }));
  }
  function reportCard(report) {
    const reported = person(report.reportedUser);
    const reporter = person(report.reporter);
    const product = person(report.product);
    const card = document.createElement('article'); card.className = 'report';
    const head = document.createElement('div'); head.className = 'report-head';
    const title = document.createElement('div');
    const h2 = document.createElement('h2'); h2.textContent = text(product?.title, report.product_title || '삭제된 판매글');
    const target = document.createElement('div'); target.className = 'meta'; target.textContent = `신고 대상: ${text(reported?.nickname, reported?.login_id || '삭제된 사용자')}`;
    title.append(h2, target);
    if (reported?.status === 'suspended') { const end = document.createElement('div'); end.className = 'suspension-end'; end.textContent = suspensionText(reported); title.append(end); }
    const created = document.createElement('div'); created.className = 'meta'; created.textContent = date(report.created_at);
    head.append(title, created);
    const reporterText = document.createElement('p'); reporterText.className = 'meta'; reporterText.textContent = `신고자: ${text(reporter?.nickname, reporter?.login_id || '삭제된 사용자')}`;
    const actions = document.createElement('div'); actions.className = 'actions';
    if (currentView === 'chat') actions.append(button('채팅 내용 확인', '', async () => { try { await showConversation(report); } catch (error) { message(error, pageError); } }));
    if (product?.id) actions.append(button('게시글 삭제', 'danger', async () => { try { await deleteProduct(product); } catch (error) { message(error, pageError); } }));
    if (reported?.id) {
      suspensionControls(reported, actions);
      actions.append(button('계정 삭제', 'danger', async () => { try { await deleteUser(reported); } catch (error) { message(error, pageError); } }));
    }
    card.append(head, reporterText, actions); return card;
  }
  function suspensionCard(user) {
    const card = document.createElement('article'); card.className = 'report';
    const head = document.createElement('div'); head.className = 'report-head';
    const title = document.createElement('div');
    const h2 = document.createElement('h2'); h2.textContent = text(user.nickname, user.login_id || '삭제된 사용자');
    const id = document.createElement('div'); id.className = 'meta'; id.textContent = `아이디: ${text(user.login_id, '-')}`;
    const end = document.createElement('div'); end.className = 'suspension-end'; end.textContent = suspensionText(user);
    title.append(h2, id, end); head.append(title);
    const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button('활동 정지 취소', 'warning', async () => { try { await cancelSuspension(user); } catch (error) { message(error, pageError); } }));
    actions.append(button('계정 삭제', 'danger', async () => { try { await deleteUser(user); } catch (error) { message(error, pageError); } }));
    card.append(head, actions); return card;
  }
  async function loadDashboard() {
    pageError.textContent = ''; reportList.replaceChildren(); empty.hidden = true;
    const titles = { product: '신고 관리', chat: '신고 관리', suspensions: '활동 정지 관리' };
    pageTitle.textContent = titles[currentView];
    empty.textContent = currentView === 'suspensions' ? '활동 정지 중인 계정이 없습니다.' : '접수된 신고가 없습니다.';
    try {
      const data = currentView === 'suspensions' ? await request('/suspensions') : await request(`/reports?targetType=${currentView}`);
      if (!data.data.length) { empty.hidden = false; return; }
      data.data.forEach((item) => reportList.append(currentView === 'suspensions' ? suspensionCard(item) : reportCard(item)));
    } catch (error) { message(error, pageError); }
  }
  function showDashboard() { loginView.hidden = true; dashboard.hidden = false; loadDashboard(); }
  loginForm.addEventListener('submit', async (event) => { event.preventDefault(); loginError.textContent = ''; try { const data = await request('/session', { method: 'POST', body: JSON.stringify({ password: password.value }) }); token = data.data.token; sessionStorage.setItem('ramarket-admin-token', token); showDashboard(); } catch (error) { message(error, loginError); } });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { currentView = tab.dataset.view; document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab)); loadDashboard(); }));
  document.querySelector('#sign-out').addEventListener('click', signOut);
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  if (token) showDashboard();
})();

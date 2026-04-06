const STORE_KEY = "allowance_dashboard_v3";

const initialState = {
  members: ["나", "첫째", "둘째"],
  activeMember: "ALL",
  budgets: {},
  goals: {},
  transactions: [],
  filters: { start: "", end: "", type: "all", category: "all" },
};

const state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(raw);
    return {
      members: Array.isArray(parsed.members) && parsed.members.length ? parsed.members : initialState.members,
      activeMember: parsed.activeMember || "ALL",
      budgets: parsed.budgets || {},
      goals: parsed.goals || {},
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      filters: { ...initialState.filters, ...(parsed.filters || {}) },
    };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function formatKRW(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function labelType(type) {
  return { allowance: "용돈 수입", saving: "저축", investment: "투자", expense: "지출" }[type] || type;
}

function memberTransactions(transactions = state.transactions) {
  return state.activeMember === "ALL" ? transactions : transactions.filter((tx) => tx.member === state.activeMember);
}

function applyFilters(transactions) {
  return transactions.filter((tx) => {
    const { start, end, type, category } = state.filters;
    if (start && tx.date < start) return false;
    if (end && tx.date > end) return false;
    if (type !== "all" && tx.type !== type) return false;
    if (category !== "all" && tx.category !== category) return false;
    return true;
  });
}

function renderMemberTabs() {
  const wrap = document.getElementById("member-tabs");
  wrap.innerHTML = "";
  ["ALL", ...state.members].forEach((member) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `member-tab ${state.activeMember === member ? "active" : ""}`;
    btn.textContent = member === "ALL" ? "전체" : member;
    btn.addEventListener("click", () => {
      state.activeMember = member;
      saveState();
      renderAll();
    });
    wrap.appendChild(btn);
  });
}

function renderMembers() {
  const memberList = document.getElementById("member-list");
  const memberSelect = document.getElementById("tx-member");
  memberList.innerHTML = "";
  memberSelect.innerHTML = "";

  state.members.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    memberList.appendChild(li);

    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    memberSelect.appendChild(option);
  });

  if (state.activeMember !== "ALL" && state.members.includes(state.activeMember)) {
    memberSelect.value = state.activeMember;
    memberSelect.disabled = true;
    setText("member-mode-hint", `${state.activeMember} 전용 입력 모드입니다. (대상 멤버 고정)`);
  } else {
    memberSelect.disabled = false;
    setText("member-mode-hint", "전체 보기 모드입니다. 입력 시 대상 멤버를 직접 고르세요.");
  }
}

function renderBudgetAndGoal() {
  const active = state.activeMember;
  const budgetSummary = document.getElementById("budget-summary");
  const goalSummary = document.getElementById("goal-summary");
  const goalProgress = document.getElementById("goal-progress");

  if (active === "ALL") {
    budgetSummary.textContent = "전체 보기에서는 멤버 탭을 선택해야 예산/목표를 편집할 수 있습니다.";
    goalSummary.textContent = "멤버 탭(나/첫째/둘째...)을 선택해 주세요.";
    goalProgress.style.width = "0%";
    return;
  }

  const budget = Number(state.budgets[active] || 0);
  const goal = Number(state.goals[active] || 0);
  const txs = memberTransactions();
  const expense = sumByType(txs, "expense");
  const saving = sumByType(txs, "saving");

  budgetSummary.textContent = budget
    ? `${active} 월 예산 ${formatKRW(budget)} / 현재 지출 ${formatKRW(expense)}`
    : `${active} 월 예산을 설정해 주세요.`;

  const goalRate = goal ? Math.min((saving / goal) * 100, 100) : 0;
  goalSummary.textContent = goal
    ? `${active} 저축 목표 ${formatKRW(goal)} / 달성 ${formatKRW(saving)} (${goalRate.toFixed(1)}%)`
    : `${active} 저축 목표를 설정해 주세요.`;
  goalProgress.style.width = `${goalRate}%`;
}

function renderKPIs(filtered) {
  const allowance = sumByType(filtered, "allowance");
  const saving = sumByType(filtered, "saving");
  const invest = sumByType(filtered, "investment");
  const expense = sumByType(filtered, "expense");
  const assetTotal = saving + invest;

  const investReturns = filtered
    .filter((tx) => tx.type === "investment" && tx.returnRate != null && !Number.isNaN(Number(tx.returnRate)))
    .map((tx) => Number(tx.returnRate));
  const avgReturn = investReturns.length ? investReturns.reduce((a, b) => a + b, 0) / investReturns.length : 0;

  setText("kpi-allowance", formatKRW(allowance));
  setText("kpi-saving", formatKRW(saving));
  setText("kpi-invest", formatKRW(invest));
  setText("kpi-expense", formatKRW(expense));
  setText("kpi-saving-ratio", `${assetTotal ? ((saving / assetTotal) * 100).toFixed(1) : 0}%`);
  setText("kpi-invest-ratio", `${assetTotal ? ((invest / assetTotal) * 100).toFixed(1) : 0}%`);
  setText("kpi-return", `${avgReturn.toFixed(2)}%`);
}

function renderDailyAllowance(filtered) {
  const dailyMap = new Map();
  filtered.filter((tx) => tx.type === "allowance").forEach((tx) => {
    dailyMap.set(tx.date, (dailyMap.get(tx.date) || 0) + Number(tx.amount));
  });
  const rows = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  document.getElementById("daily-table").innerHTML = rows.map(([d, a]) => `<tr><td>${d}</td><td>${formatKRW(a)}</td></tr>`).join("") || `<tr><td colspan="2">데이터 없음</td></tr>`;
}

function renderCategorySummary(filtered) {
  const map = new Map();
  filtered.forEach((tx) => map.set(tx.category, (map.get(tx.category) || 0) + Number(tx.amount)));
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  document.getElementById("category-table").innerHTML = rows.map(([c, a]) => `<tr><td>${c}</td><td>${formatKRW(a)}</td></tr>`).join("") || `<tr><td colspan="2">데이터 없음</td></tr>`;
}

function renderTransactions(filtered) {
  const rows = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("tx-table").innerHTML = rows.map((tx) => `<tr><td>${tx.date}</td><td>${tx.member}</td><td>${labelType(tx.type)}</td><td>${tx.category}</td><td>${formatKRW(tx.amount)}</td><td>${tx.returnRate ?? "-"}${tx.returnRate != null ? "%" : ""}</td><td>${tx.note || ""}</td></tr>`).join("") || `<tr><td colspan="7">데이터 없음</td></tr>`;
}

function hydrateFilters() {
  document.getElementById("filter-start").value = state.filters.start;
  document.getElementById("filter-end").value = state.filters.end;
  document.getElementById("filter-type").value = state.filters.type;
  document.getElementById("filter-category").value = state.filters.category;
}

function sumByType(transactions, type) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function parseReturnRate(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function wireEvents() {
  document.getElementById("member-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("member-name").value.trim();
    if (!name || state.members.includes(name)) return;
    state.members.push(name);
    saveState();
    renderAll();
    e.target.reset();
  });

  document.getElementById("budget-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.activeMember === "ALL") return;
    state.budgets[state.activeMember] = Number(document.getElementById("budget-amount").value || 0);
    saveState();
    renderBudgetAndGoal();
    e.target.reset();
  });

  document.getElementById("goal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.activeMember === "ALL") return;
    state.goals[state.activeMember] = Number(document.getElementById("goal-amount").value || 0);
    saveState();
    renderBudgetAndGoal();
    e.target.reset();
  });

  document.getElementById("tx-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const tx = {
      date: document.getElementById("tx-date").value,
      member: document.getElementById("tx-member").value,
      type: document.getElementById("tx-type").value,
      category: document.getElementById("tx-category").value,
      amount: Number(document.getElementById("tx-amount").value || 0),
      returnRate: parseReturnRate(document.getElementById("tx-return").value),
      note: document.getElementById("tx-note").value.trim(),
    };
    if (!tx.date || !tx.member || tx.amount < 0) return;
    if (tx.type !== "investment") tx.returnRate = null;
    state.transactions.push(tx);
    saveState();
    renderAll();
    e.target.reset();
    document.getElementById("tx-date").valueAsDate = new Date();
  });

  document.getElementById("filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.filters.start = document.getElementById("filter-start").value;
    state.filters.end = document.getElementById("filter-end").value;
    state.filters.type = document.getElementById("filter-type").value;
    state.filters.category = document.getElementById("filter-category").value;
    saveState();
    renderAll();
  });

  document.getElementById("filter-reset").addEventListener("click", () => {
    state.filters = structuredClone(initialState.filters);
    saveState();
    renderAll();
  });
}

function renderAll() {
  renderMemberTabs();
  renderMembers();
  renderBudgetAndGoal();
  hydrateFilters();
  const filtered = applyFilters(memberTransactions());
  renderKPIs(filtered);
  renderDailyAllowance(filtered);
  renderCategorySummary(filtered);
  renderTransactions(filtered);
}

function init() {
  wireEvents();
  document.getElementById("tx-date").valueAsDate = new Date();
  renderAll();
}

init();

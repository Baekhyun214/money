const STORE_KEY = "allowance_dashboard_v2";

const initialState = {
  members: ["나", "첫째", "둘째"],
  activeMember: "ALL",
  budgets: {},
  goals: {},
  transactions: [],
  filters: {
    start: "",
    end: "",
    type: "all",
    category: "all",
  },
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
      filters: {
        ...initialState.filters,
        ...(parsed.filters || {}),
      },
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

function getActiveMember() {
  return state.activeMember;
}

function memberTransactions(transactions = state.transactions) {
  const active = getActiveMember();
  if (active === "ALL") return transactions;
  return transactions.filter((tx) => tx.member === active);
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

function renderMembers() {
  const memberList = document.getElementById("member-list");
  const memberSelect = document.getElementById("tx-member");
  const activeMemberSelect = document.getElementById("active-member");

  memberList.innerHTML = "";
  memberSelect.innerHTML = "";
  activeMemberSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "ALL";
  allOption.textContent = "전체 보기";
  activeMemberSelect.appendChild(allOption);

  state.members.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    memberList.appendChild(li);

    const txOption = document.createElement("option");
    txOption.value = name;
    txOption.textContent = name;
    memberSelect.appendChild(txOption);

    const activeOption = document.createElement("option");
    activeOption.value = name;
    activeOption.textContent = `${name} 보기`;
    activeMemberSelect.appendChild(activeOption);
  });

  if (!["ALL", ...state.members].includes(state.activeMember)) {
    state.activeMember = "ALL";
  }
  activeMemberSelect.value = state.activeMember;
}

function renderBudgetAndGoal() {
  const active = getActiveMember();
  const budgetSummary = document.getElementById("budget-summary");
  const goalSummary = document.getElementById("goal-summary");
  const goalProgress = document.getElementById("goal-progress");

  if (active === "ALL") {
    budgetSummary.textContent = "전체 보기에서는 멤버를 선택해 예산을 관리하세요.";
    goalSummary.textContent = "전체 보기에서는 멤버를 선택해 목표를 관리하세요.";
    goalProgress.style.width = "0%";
    return;
  }

  const budget = Number(state.budgets[active] || 0);
  const goal = Number(state.goals[active] || 0);
  const expense = sumByType(memberTransactions(), "expense");
  const saving = sumByType(memberTransactions(), "saving");

  budgetSummary.textContent = budget
    ? `${active} 월 예산: ${formatKRW(budget)} / 현재 지출: ${formatKRW(expense)}`
    : `${active}의 월 예산이 설정되지 않았습니다.`;

  const goalRate = goal ? Math.min((saving / goal) * 100, 100) : 0;
  goalSummary.textContent = goal
    ? `${active} 저축 목표: ${formatKRW(goal)} / 달성: ${formatKRW(saving)} (${goalRate.toFixed(1)}%)`
    : `${active}의 저축 목표가 설정되지 않았습니다.`;
  goalProgress.style.width = `${goalRate}%`;
}

function renderDailyAllowance(filtered) {
  const dailyMap = new Map();
  filtered
    .filter((tx) => tx.type === "allowance")
    .forEach((tx) => {
      dailyMap.set(tx.date, (dailyMap.get(tx.date) || 0) + Number(tx.amount));
    });

  const rows = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const body = document.getElementById("daily-table");
  body.innerHTML = rows
    .map(([date, amount]) => `<tr><td>${date}</td><td>${formatKRW(amount)}</td></tr>`)
    .join("") || `<tr><td colspan="2">데이터 없음</td></tr>`;
}

function renderCategorySummary(filtered) {
  const map = new Map();
  filtered.forEach((tx) => {
    const key = tx.category || "기타";
    map.set(key, (map.get(key) || 0) + Number(tx.amount));
  });
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const body = document.getElementById("category-table");
  body.innerHTML = rows
    .map(([category, amount]) => `<tr><td>${category}</td><td>${formatKRW(amount)}</td></tr>`)
    .join("") || `<tr><td colspan="2">데이터 없음</td></tr>`;
}

function renderTransactions(filtered) {
  const body = document.getElementById("tx-table");
  const rows = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  body.innerHTML = rows
    .map(
      (tx) => `<tr>
      <td>${tx.date}</td>
      <td>${tx.member}</td>
      <td>${labelType(tx.type)}</td>
      <td>${tx.category || "-"}</td>
      <td>${formatKRW(tx.amount)}</td>
      <td>${tx.returnRate ?? "-"}${tx.returnRate != null ? "%" : ""}</td>
      <td>${tx.note || ""}</td>
    </tr>`,
    )
    .join("") || `<tr><td colspan="7">데이터 없음</td></tr>`;
}

function renderKPIs(filtered) {
  const allowance = sumByType(filtered, "allowance");
  const saving = sumByType(filtered, "saving");
  const invest = sumByType(filtered, "investment");
  const expense = sumByType(filtered, "expense");
  const assetTotal = saving + invest;
  const savingRatio = assetTotal ? (saving / assetTotal) * 100 : 0;
  const investRatio = assetTotal ? (invest / assetTotal) * 100 : 0;

  const investReturns = filtered
    .filter((tx) => tx.type === "investment" && tx.returnRate != null && !Number.isNaN(Number(tx.returnRate)))
    .map((tx) => Number(tx.returnRate));
  const avgReturn = investReturns.length
    ? investReturns.reduce((a, b) => a + b, 0) / investReturns.length
    : 0;

  setText("kpi-allowance", formatKRW(allowance));
  setText("kpi-saving", formatKRW(saving));
  setText("kpi-invest", formatKRW(invest));
  setText("kpi-expense", formatKRW(expense));
  setText("kpi-saving-ratio", `${savingRatio.toFixed(1)}%`);
  setText("kpi-invest-ratio", `${investRatio.toFixed(1)}%`);
  setText("kpi-return", `${avgReturn.toFixed(2)}%`);
}

function labelType(type) {
  const map = {
    allowance: "용돈 수입",
    saving: "저축",
    investment: "투자",
    expense: "지출",
  };
  return map[type] || type;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function sumByType(transactions, type) {
  return transactions
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function wireEvents() {
  document.getElementById("active-member").addEventListener("change", (e) => {
    state.activeMember = e.target.value;
    saveState();
    renderAll();
  });

  document.getElementById("member-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("member-name");
    const name = input.value.trim();
    if (!name || state.members.includes(name)) return;
    state.members.push(name);
    saveState();
    renderAll();
    input.value = "";
  });

  document.getElementById("budget-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const active = getActiveMember();
    if (active === "ALL") return;
    state.budgets[active] = Number(document.getElementById("budget-amount").value || 0);
    saveState();
    renderBudgetAndGoal();
    e.target.reset();
  });

  document.getElementById("goal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const active = getActiveMember();
    if (active === "ALL") return;
    state.goals[active] = Number(document.getElementById("goal-amount").value || 0);
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
    document.getElementById("filter-form").reset();
    saveState();
    renderAll();
  });
}

function hydrateFilters() {
  document.getElementById("filter-start").value = state.filters.start;
  document.getElementById("filter-end").value = state.filters.end;
  document.getElementById("filter-type").value = state.filters.type;
  document.getElementById("filter-category").value = state.filters.category;
}

function parseReturnRate(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function renderAll() {
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

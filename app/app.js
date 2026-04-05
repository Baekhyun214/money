const STORE_KEY = "allowance_dashboard_v1";

const initialState = {
  members: ["나", "첫째", "둘째"],
  transactions: [],
};

const state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(raw);
    return {
      members: Array.isArray(parsed.members) && parsed.members.length ? parsed.members : initialState.members,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
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
}

function renderDailyAllowance() {
  const dailyMap = new Map();
  state.transactions
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

function renderTransactions() {
  const body = document.getElementById("tx-table");
  const rows = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
  body.innerHTML = rows
    .map(
      (tx) => `<tr>
      <td>${tx.date}</td>
      <td>${tx.member}</td>
      <td>${tx.type}</td>
      <td>${formatKRW(tx.amount)}</td>
      <td>${tx.returnRate ?? "-"}${tx.returnRate != null ? "%" : ""}</td>
      <td>${tx.note || ""}</td>
    </tr>`,
    )
    .join("") || `<tr><td colspan="6">데이터 없음</td></tr>`;
}

function renderKPIs() {
  const allowance = sumByType("allowance");
  const saving = sumByType("saving");
  const invest = sumByType("investment");
  const assetTotal = saving + invest;
  const savingRatio = assetTotal ? (saving / assetTotal) * 100 : 0;
  const investRatio = assetTotal ? (invest / assetTotal) * 100 : 0;

  const investReturns = state.transactions
    .filter((tx) => tx.type === "investment" && tx.returnRate != null && !Number.isNaN(Number(tx.returnRate)))
    .map((tx) => Number(tx.returnRate));
  const avgReturn = investReturns.length
    ? investReturns.reduce((a, b) => a + b, 0) / investReturns.length
    : 0;

  setText("kpi-allowance", formatKRW(allowance));
  setText("kpi-saving", formatKRW(saving));
  setText("kpi-invest", formatKRW(invest));
  setText("kpi-saving-ratio", `${savingRatio.toFixed(1)}%`);
  setText("kpi-invest-ratio", `${investRatio.toFixed(1)}%`);
  setText("kpi-return", `${avgReturn.toFixed(2)}%`);
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function sumByType(type) {
  return state.transactions
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function wireEvents() {
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

  document.getElementById("tx-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const tx = {
      date: document.getElementById("tx-date").value,
      member: document.getElementById("tx-member").value,
      type: document.getElementById("tx-type").value,
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
}

function parseReturnRate(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function renderAll() {
  renderMembers();
  renderKPIs();
  renderDailyAllowance();
  renderTransactions();
}

function init() {
  wireEvents();
  document.getElementById("tx-date").valueAsDate = new Date();
  renderAll();
}

init();

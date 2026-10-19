"use strict";

(() => {
  const KEY = "apostol_budget_v1";
  const MIN_MASTERS = 1;
  const MAX_MASTERS = 20;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const PAYMENTS = new Set([
    "Наличные",
    "Карта / терминал",
    "Перевод",
    "Другое"
  ]);
  const CATEGORIES = new Set([
    "Аренда",
    "Материалы",
    "Реклама",
    "Коммунальные услуги",
    "Налоги",
    "Оборудование",
    "Прочее"
  ]);

  const defaultServices = [
    "Маникюр",
    "Педикюр",
    "Наращивание ресниц",
    "Ламинирование ресниц",
    "Ламинирование бровей",
    "Оформление бровей",
    "Депиляция",
    "Массаж",
    "Карбоновый пилинг",
    "Лазерное удаление тату"
  ];

  const $ = id => document.getElementById(id);

  const money = value =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB"
    }).format(value);

  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    "id-" + Date.now() + "-" +
    Math.random().toString(36).slice(2);

  const today = () => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  };

  const toKopecks = rubles => Math.round(Number(rubles) * 100);

  const fromKopecks = kopecks => kopecks / 100;

  const normalizeMoney = rubles => fromKopecks(toKopecks(rubles));

  const isValidDate = value => {
    if (typeof value !== "string" || !DATE_RE.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return (
      dt.getFullYear() === y &&
      dt.getMonth() === m - 1 &&
      dt.getDate() === d
    );
  };

  const uniqueIds = items => {
    const ids = items.map(item => item.id);
    return new Set(ids).size === ids.length;
  };

  function initial() {
    return {
      masters: Array.from({length: 4}, (_, i) => ({
        id: "master-" + (i + 1),
        name: "Мастер " + (i + 1),
        percent: 50
      })),
      incomes: [],
      expenses: []
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object") return null;

    const masters = Array.isArray(raw.masters)
      ? raw.masters.map(m => ({
          id: String(m.id || "").trim(),
          name: String(m.name || "").trim(),
          percent: normalizeMoney(m.percent)
        }))
      : null;

    const incomes = Array.isArray(raw.incomes)
      ? raw.incomes.map(i => ({
          id: String(i.id || "").trim(),
          date: String(i.date || "").trim(),
          masterId: String(i.masterId || "").trim(),
          service: String(i.service || "").trim(),
          amount: normalizeMoney(i.amount),
          percent: normalizeMoney(i.percent),
          payment: PAYMENTS.has(i.payment) ? i.payment : "Другое"
        }))
      : null;

    const expenses = Array.isArray(raw.expenses)
      ? raw.expenses.map(e => ({
          id: String(e.id || "").trim(),
          date: String(e.date || "").trim(),
          category: CATEGORIES.has(e.category) ? e.category : "Прочее",
          amount: normalizeMoney(e.amount),
          comment: String(e.comment || "").trim().slice(0, 200)
        }))
      : null;

    const state = {masters, incomes, expenses};
    return validate(state) ? state : null;
  }

  function validate(s) {
    if (
      !s ||
      !Array.isArray(s.masters) ||
      !Array.isArray(s.incomes) ||
      !Array.isArray(s.expenses) ||
      s.masters.length < MIN_MASTERS ||
      s.masters.length > MAX_MASTERS ||
      !uniqueIds(s.masters) ||
      !uniqueIds(s.incomes) ||
      !uniqueIds(s.expenses)
    ) {
      return false;
    }

    const masterIds = new Set(s.masters.map(m => m.id));

    const mastersOk = s.masters.every(m =>
      typeof m.id === "string" &&
      m.id.length > 0 &&
      typeof m.name === "string" &&
      m.name.length > 0 &&
      m.name.length <= 60 &&
      Number.isFinite(m.percent) &&
      m.percent >= 0 &&
      m.percent <= 100 &&
      Number.isInteger(toKopecks(m.percent))
    );

    const incomesOk = s.incomes.every(i =>
      typeof i.id === "string" &&
      i.id.length > 0 &&
      isValidDate(i.date) &&
      typeof i.masterId === "string" &&
      masterIds.has(i.masterId) &&
      typeof i.service === "string" &&
      i.service.length > 0 &&
      i.service.length <= 100 &&
      Number.isFinite(i.amount) &&
      i.amount > 0 &&
      Number.isInteger(toKopecks(i.amount)) &&
      Number.isFinite(i.percent) &&
      i.percent >= 0 &&
      i.percent <= 100 &&
      Number.isInteger(toKopecks(i.percent)) &&
      PAYMENTS.has(i.payment)
    );

    const expensesOk = s.expenses.every(e =>
      typeof e.id === "string" &&
      e.id.length > 0 &&
      isValidDate(e.date) &&
      typeof e.category === "string" &&
      CATEGORIES.has(e.category) &&
      Number.isFinite(e.amount) &&
      e.amount > 0 &&
      Number.isInteger(toKopecks(e.amount)) &&
      typeof e.comment === "string" &&
      e.comment.length <= 200
    );

    return mastersOk && incomesOk && expensesOk;
  }

  function repairState(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!Array.isArray(raw.masters) || raw.masters.length < MIN_MASTERS) {
      return null;
    }

    const masters = raw.masters.slice(0, MAX_MASTERS).map((m, i) => ({
      id: String(m?.id || "").trim() || ("master-" + (i + 1)),
      name: String(m?.name || "").trim() || ("Мастер " + (i + 1)),
      percent: Math.min(100, Math.max(0, normalizeMoney(m?.percent ?? 50)))
    }));

    const seenMaster = new Set();
    const uniqueMasters = masters.filter(m => {
      if (seenMaster.has(m.id)) return false;
      seenMaster.add(m.id);
      return true;
    });

    if (uniqueMasters.length < MIN_MASTERS) return null;

    const masterIds = new Set(uniqueMasters.map(m => m.id));
    const seenIncome = new Set();
    const seenExpense = new Set();

    const incomes = (Array.isArray(raw.incomes) ? raw.incomes : [])
      .map(i => ({
        id: String(i?.id || "").trim() || uid(),
        date: String(i?.date || "").trim(),
        masterId: String(i?.masterId || "").trim(),
        service: String(i?.service || "").trim().slice(0, 100),
        amount: normalizeMoney(i?.amount),
        percent: Math.min(100, Math.max(0, normalizeMoney(i?.percent ?? 0))),
        payment: PAYMENTS.has(i?.payment) ? i.payment : "Другое"
      }))
      .filter(i =>
        i.id &&
        !seenIncome.has(i.id) &&
        (seenIncome.add(i.id), true) &&
        isValidDate(i.date) &&
        masterIds.has(i.masterId) &&
        i.service &&
        i.amount > 0
      );

    const expenses = (Array.isArray(raw.expenses) ? raw.expenses : [])
      .map(e => ({
        id: String(e?.id || "").trim() || uid(),
        date: String(e?.date || "").trim(),
        category: CATEGORIES.has(e?.category) ? e.category : "Прочее",
        amount: normalizeMoney(e?.amount),
        comment: String(e?.comment || "").trim().slice(0, 200)
      }))
      .filter(e =>
        e.id &&
        !seenExpense.has(e.id) &&
        (seenExpense.add(e.id), true) &&
        isValidDate(e.date) &&
        e.amount > 0
      );

    const repaired = {
      masters: uniqueMasters,
      incomes,
      expenses
    };

    return validate(repaired) ? repaired : null;
  }

  let state;

  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    state = normalizeState(saved) || repairState(saved) || initial();
  } catch {
    state = initial();
  }

  let editIncome = null;
  let editExpense = null;
  let optionsSignature = "";

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      alert(
        "Не удалось сохранить данные. " +
        "Скачайте резервную копию."
      );
      console.error(error);
    }
  }

  function option(select, value, label) {
    const el = document.createElement("option");
    el.value = value;
    el.textContent = label;
    select.append(el);
  }

  function cell(row, value) {
    const td = document.createElement("td");
    td.textContent = String(value);
    row.append(td);
  }

  function emptyRow(colspan, text) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colspan;
    td.className = "empty";
    td.textContent = text;
    tr.append(td);
    return tr;
  }

  function salary(income) {
    return fromKopecks(
      Math.round(toKopecks(income.amount) * income.percent / 100)
    );
  }

  function masterName(id) {
    return state.masters.find(m => m.id === id)?.name ||
      "Неизвестный мастер";
  }

  function sum(rows, fn) {
    return fromKopecks(
      rows.reduce((total, row) => total + toKopecks(fn(row)), 0)
    );
  }

  function dateRangeInvalid() {
    const from = $("from").value;
    const to = $("to").value;
    return !!(from && to && from > to);
  }

  function dateMatch(date) {
    if (dateRangeInvalid()) return false;

    const from = $("from").value;
    const to = $("to").value;

    return (
      (!from || date >= from) &&
      (!to || date <= to)
    );
  }

  function filteredIncomes() {
    return state.incomes.filter(i =>
      dateMatch(i.date) &&
      (!$("filterMaster").value ||
        i.masterId === $("filterMaster").value) &&
      (!$("filterService").value ||
        i.service === $("filterService").value)
    );
  }

  function filteredExpenses() {
    return state.expenses.filter(e => dateMatch(e.date));
  }

  function focusSoon(el) {
    requestAnimationFrame(() => {
      el?.focus({preventScroll: true});
    });
  }

  function renderSettings() {
    const root = $("mastersSettings");
    root.replaceChildren();

    const fragment = document.createDocumentFragment();

    state.masters.forEach((m, index) => {
      const row = document.createElement("div");
      row.className = "master-row";

      const name = document.createElement("input");
      name.value = m.name;
      name.maxLength = 60;
      name.dataset.masterName = m.id;
      name.setAttribute(
        "aria-label",
        "Имя мастера " + (index + 1)
      );

      const percent = document.createElement("input");
      percent.type = "number";
      percent.min = 0;
      percent.max = 100;
      percent.step = "0.01";
      percent.value = m.percent;
      percent.dataset.masterPercent = m.id;
      percent.setAttribute(
        "aria-label",
        "Процент мастера " + (index + 1)
      );

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "Удалить";
      remove.dataset.removeMaster = m.id;
      remove.setAttribute(
        "aria-label",
        "Удалить мастера " + (index + 1)
      );
      remove.disabled =
        state.masters.length <= MIN_MASTERS ||
        state.incomes.some(i => i.masterId === m.id);

      row.append(name, percent, remove);
      fragment.append(row);
    });

    root.append(fragment);
    $("addMaster").disabled = state.masters.length >= MAX_MASTERS;
  }

  function syncMasterRemoveButtons() {
    state.masters.forEach(m => {
      const btn = document.querySelector(
        `[data-remove-master="${CSS.escape(m.id)}"]`
      );
      if (!btn) return;
      btn.disabled =
        state.masters.length <= MIN_MASTERS ||
        state.incomes.some(i => i.masterId === m.id);
    });
  }

  function renderOptions() {
    const signature = [
      state.masters.map(m => m.id + "\0" + m.name).join("|"),
      [...new Set(state.incomes.map(i => i.service))].sort().join("|")
    ].join("::");

    if (signature === optionsSignature) return;
    optionsSignature = signature;

    const fm = $("filterMaster");
    const im = $("incomeMaster");
    const fs = $("filterService");

    const oldM = fm.value;
    const oldI = im.value;
    const oldS = fs.value;

    fm.replaceChildren();
    im.replaceChildren();
    fs.replaceChildren();

    option(fm, "", "Все мастера");
    option(fs, "", "Все услуги");

    state.masters.forEach(m => {
      option(fm, m.id, m.name);
      option(im, m.id, m.name);
    });

    const services = [
      ...new Set([
        ...defaultServices,
        ...state.incomes.map(i => i.service)
      ])
    ].sort((a, b) => a.localeCompare(b, "ru"));

    services.forEach(s => option(fs, s, s));

    fm.value = [...fm.options].some(o => o.value === oldM)
      ? oldM : "";

    im.value = [...im.options].some(o => o.value === oldI)
      ? oldI
      : (state.masters[0]?.id || "");

    fs.value = [...fs.options].some(o => o.value === oldS)
      ? oldS : "";

    $("services").replaceChildren();
    services.forEach(s => option($("services"), s, s));
  }

  function render() {
    renderOptions();

    const rangeBad = dateRangeInvalid();
    const incomes = rangeBad ? [] : filteredIncomes();
    const expenses = rangeBad ? [] : filteredExpenses();

    const revenue = sum(incomes, i => i.amount);
    const pay = sum(incomes, salary);
    const share = normalizeMoney(revenue - pay);
    const cost = sum(expenses, e => e.amount);

    $("revenue").textContent = money(revenue);
    $("salary").textContent = money(pay);
    $("studioShare").textContent = money(share);
    $("expensesTotal").textContent = money(cost);

    const narrowed = !!(
      $("filterMaster").value ||
      $("filterService").value
    );

    let profit;

    if (rangeBad) {
      profit = 0;
      $("profitLabel").textContent = "Прибыль студии за период";
      $("filterNote").textContent =
        "Дата «с» не может быть позже даты «по». " +
        "Исправьте период или сбросьте фильтры.";
      $("filterNote").className = "hint warn";
    } else if (narrowed) {
      const all = state.incomes.filter(i => dateMatch(i.date));
      profit = normalizeMoney(
        sum(all, i => i.amount - salary(i)) - cost
      );

      $("profitLabel").textContent =
        "Прибыль всей студии за период";

      $("filterNote").textContent =
        "Выручка, выплаты и доля студии показаны " +
        "по выбранному мастеру или услуге. " +
        "Расходы и итоговая прибыль относятся " +
        "ко всей студии за выбранный период.";
      $("filterNote").className = "hint";
    } else {
      profit = normalizeMoney(share - cost);

      $("profitLabel").textContent =
        "Прибыль студии за период";

      $("filterNote").textContent =
        "Прибыль = выручка − выплаты мастерам − " +
        "общие расходы. Налоги учитываются, " +
        "если внесены в расходы.";
      $("filterNote").className = "hint";
    }

    $("profit").textContent = money(profit);
    $("profit").className =
      profit < 0 ? "negative" : "positive";

    renderIncomeRows(incomes);
    renderExpenseRows(expenses);
    renderReport(
      "masterReport",
      incomes,
      "masterId",
      masterName,
      "За выбранный период доходов нет."
    );
    renderReport(
      "serviceReport",
      incomes,
      "service",
      x => x,
      "За выбранный период услуг нет."
    );
  }

  function renderIncomeRows(incomes) {
    const root = $("incomeRows");
    root.replaceChildren();

    if (!incomes.length) {
      root.append(emptyRow(9, "Доходов за выбранный период нет."));
      return;
    }

    const fragment = document.createDocumentFragment();

    [...incomes]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(i => {
        const tr = document.createElement("tr");
        tr.dataset.incomeId = i.id;

        [
          i.date,
          masterName(i.masterId),
          i.service,
          money(i.amount),
          i.percent + "%",
          money(salary(i)),
          money(normalizeMoney(i.amount - salary(i))),
          i.payment || "—"
        ].forEach(v => cell(tr, v));

        const td = document.createElement("td");

        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Изменить";
        edit.className = "secondary";
        edit.dataset.action = "edit-income";

        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Удалить";
        del.className = "danger";
        del.dataset.action = "delete-income";

        td.append(edit, del);
        tr.append(td);
        fragment.append(tr);
      });

    root.append(fragment);
  }

  function renderExpenseRows(expenses) {
    const root = $("expenseRows");
    root.replaceChildren();

    if (!expenses.length) {
      root.append(emptyRow(5, "Расходов за выбранный период нет."));
      return;
    }

    const fragment = document.createDocumentFragment();

    [...expenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(e => {
        const tr = document.createElement("tr");
        tr.dataset.expenseId = e.id;

        [
          e.date,
          e.category,
          e.comment || "—",
          money(e.amount)
        ].forEach(v => cell(tr, v));

        const td = document.createElement("td");

        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Изменить";
        edit.className = "secondary";
        edit.dataset.action = "edit-expense";

        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Удалить";
        del.className = "danger";
        del.dataset.action = "delete-expense";

        td.append(edit, del);
        tr.append(td);
        fragment.append(tr);
      });

    root.append(fragment);
  }

  function renderReport(target, keyRows, key, label, emptyText) {
    const map = new Map();

    keyRows.forEach(i => {
      const k = i[key];

      if (!map.has(k)) {
        map.set(k, {count: 0, revenueK: 0, payK: 0});
      }

      const item = map.get(k);
      item.count++;
      item.revenueK += toKopecks(i.amount);
      item.payK += toKopecks(salary(i));
    });

    const root = $(target);
    root.replaceChildren();

    if (!map.size) {
      root.append(emptyRow(5, emptyText));
      return;
    }

    const fragment = document.createDocumentFragment();

    [...map]
      .sort((a, b) => b[1].revenueK - a[1].revenueK)
      .forEach(([k, item]) => {
        const tr = document.createElement("tr");

        [
          label(k),
          item.count,
          money(fromKopecks(item.revenueK)),
          money(fromKopecks(item.payK)),
          money(fromKopecks(item.revenueK - item.payK))
        ].forEach(v => cell(tr, v));

        fragment.append(tr);
      });

    root.append(fragment);
  }

  function resetIncome(focus = false) {
    editIncome = null;
    $("incomeForm").reset();
    $("incomeDate").value = today();
    if (state.masters[0]) {
      $("incomeMaster").value = state.masters[0].id;
    }
    $("incomeHeading").textContent = "Добавить доход";
    $("incomeSubmit").textContent = "Добавить доход";
    $("incomeCancel").classList.add("hidden");
    if (focus) focusSoon($("incomeDate"));
  }

  function resetExpense(focus = false) {
    editExpense = null;
    $("expenseForm").reset();
    $("expenseDate").value = today();
    $("expenseHeading").textContent = "Добавить общий расход";
    $("expenseSubmit").textContent = "Добавить расход";
    $("expenseCancel").classList.add("hidden");
    if (focus) focusSoon($("expenseDate"));
  }

  function startIncomeEdit(i) {
    editIncome = i.id;

    $("incomeDate").value = i.date;
    $("incomeMaster").value = i.masterId;
    $("incomeService").value = i.service;
    $("incomeAmount").value = i.amount;
    $("incomePayment").value = i.payment || "Другое";

    $("incomeHeading").textContent = "Редактировать доход";
    $("incomeSubmit").textContent = "Сохранить изменения";
    $("incomeCancel").classList.remove("hidden");

    $("incomeForm").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    focusSoon($("incomeDate"));
  }

  function startExpenseEdit(e) {
    editExpense = e.id;

    $("expenseDate").value = e.date;
    $("expenseCategory").value =
      CATEGORIES.has(e.category) ? e.category : "Прочее";
    $("expenseAmount").value = e.amount;
    $("expenseComment").value = e.comment || "";

    $("expenseHeading").textContent = "Редактировать расход";
    $("expenseSubmit").textContent = "Сохранить изменения";
    $("expenseCancel").classList.remove("hidden");

    $("expenseForm").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    focusSoon($("expenseDate"));
  }

  $("mastersSettings").addEventListener("click", event => {
    const btn = event.target.closest("[data-remove-master]");
    if (!btn) return;

    const id = btn.dataset.removeMaster;

    if (state.masters.length <= MIN_MASTERS) {
      alert("Нужен хотя бы один мастер.");
      return;
    }

    if (state.incomes.some(i => i.masterId === id)) {
      alert("Нельзя удалить мастера, у которого есть доходы.");
      return;
    }

    if (!confirm("Удалить этого мастера из настроек?")) return;

    state.masters = state.masters.filter(m => m.id !== id);
    optionsSignature = "";
    save();
    renderSettings();
    render();
  });

  $("addMaster").onclick = () => {
    if (state.masters.length >= MAX_MASTERS) {
      alert("Можно добавить не больше " + MAX_MASTERS + " мастеров.");
      return;
    }

    state.masters.push({
      id: uid(),
      name: "Мастер " + (state.masters.length + 1),
      percent: 50
    });

    optionsSignature = "";
    save();
    renderSettings();
    render();
    focusSoon(
      document.querySelector(
        `[data-master-name="${CSS.escape(state.masters.at(-1).id)}"]`
      )
    );
  };

  $("saveMasters").onclick = () => {
    const next = state.masters.map(m => {
      const nameEl = document.querySelector(
        `[data-master-name="${CSS.escape(m.id)}"]`
      );
      const percentEl = document.querySelector(
        `[data-master-percent="${CSS.escape(m.id)}"]`
      );

      return {
        id: m.id,
        name: nameEl.value.trim(),
        percent: normalizeMoney(percentEl.value)
      };
    });

    if (next.some(m =>
      !m.name ||
      !Number.isFinite(m.percent) ||
      m.percent < 0 ||
      m.percent > 100
    )) {
      alert("Укажите имя и процент от 0 до 100.");
      return;
    }

    state.masters = next;
    optionsSignature = "";
    save();
    renderSettings();
    render();
    alert("Настройки мастеров сохранены.");
  };

  $("incomeForm").onsubmit = event => {
    event.preventDefault();

    const master = state.masters.find(
      m => m.id === $("incomeMaster").value
    );

    const amount = normalizeMoney($("incomeAmount").value);
    const service = $("incomeService").value.trim();
    const date = $("incomeDate").value;

    if (
      !master ||
      !service ||
      !isValidDate(date) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert("Проверьте данные дохода.");
      return;
    }

    const old = state.incomes.find(
      i => i.id === editIncome
    );

    const entry = {
      id: editIncome || uid(),
      date,
      masterId: master.id,
      service,
      amount,
      percent: old && old.masterId === master.id
        ? old.percent
        : normalizeMoney(master.percent),
      payment: $("incomePayment").value
    };

    if (editIncome) {
      state.incomes = state.incomes.map(
        i => i.id === editIncome ? entry : i
      );
    } else {
      state.incomes.push(entry);
    }

    optionsSignature = "";
    save();
    resetIncome(true);
    syncMasterRemoveButtons();
    render();
  };

  $("expenseForm").onsubmit = event => {
    event.preventDefault();

    const amount = normalizeMoney($("expenseAmount").value);
    const date = $("expenseDate").value;

    if (
      !isValidDate(date) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert("Введите корректную дату и положительную сумму.");
      return;
    }

    const entry = {
      id: editExpense || uid(),
      date,
      category: $("expenseCategory").value,
      amount,
      comment: $("expenseComment").value.trim()
    };

    if (editExpense) {
      state.expenses = state.expenses.map(
        e => e.id === editExpense ? entry : e
      );
    } else {
      state.expenses.push(entry);
    }

    save();
    resetExpense(true);
    render();
  };

  $("incomeCancel").onclick = () => resetIncome(true);
  $("expenseCancel").onclick = () => resetExpense(true);

  $("incomeRows").addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.closest("tr")?.dataset.incomeId;
    const item = state.incomes.find(i => i.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit-income") {
      startIncomeEdit(item);
      return;
    }

    if (btn.dataset.action === "delete-income") {
      if (!confirm("Удалить эту запись дохода?")) return;
      state.incomes = state.incomes.filter(x => x.id !== id);
      optionsSignature = "";
      save();
      syncMasterRemoveButtons();
      render();
    }
  });

  $("expenseRows").addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.closest("tr")?.dataset.expenseId;
    const item = state.expenses.find(e => e.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit-expense") {
      startExpenseEdit(item);
      return;
    }

    if (btn.dataset.action === "delete-expense") {
      if (!confirm("Удалить этот расход?")) return;
      state.expenses = state.expenses.filter(x => x.id !== id);
      save();
      render();
    }
  });

  ["from", "to", "filterMaster", "filterService"]
    .forEach(id => {
      $(id).addEventListener("change", render);
    });

  $("resetFilters").onclick = () => {
    ["from", "to", "filterMaster", "filterService"]
      .forEach(id => { $(id).value = ""; });

    render();
  };

  function download(filename, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $("exportBtn").onclick = () => {
    download(
      "apostol-backup-" + today() + ".json",
      JSON.stringify(state, null, 2),
      "application/json;charset=utf-8"
    );
  };

  $("importBtn").onclick = () => {
    $("importFile").click();
  };

  $("importFile").onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Файл слишком большой.");
      }

      const raw = JSON.parse(await file.text());
      const parsed = normalizeState(raw) || repairState(raw);

      if (!parsed) {
        throw new Error("Неверный формат файла.");
      }

      if (!confirm(
        "Заменить все текущие данные резервной копией?"
      )) return;

      state = parsed;
      optionsSignature = "";
      save();
      resetIncome();
      resetExpense();
      renderSettings();
      render();

      alert("Резервная копия загружена.");
    } catch (error) {
      alert("Ошибка загрузки: " + error.message);
    } finally {
      event.target.value = "";
    }
  };

  const csvCell = value =>
    '"' + String(value ?? "").replaceAll('"', '""') + '"';

  const csv = rows =>
    "\uFEFF" +
    rows.map(row => row.map(csvCell).join(";"))
      .join("\r\n");

  $("incomeCsv").onclick = () => {
    if (dateRangeInvalid()) {
      alert("Исправьте период дат перед экспортом.");
      return;
    }

    const rows = [
      [
        "Дата", "Мастер", "Услуга", "Выручка",
        "Процент", "Мастеру", "Студии", "Оплата"
      ],
      ...filteredIncomes().map(i => [
        i.date,
        masterName(i.masterId),
        i.service,
        i.amount,
        i.percent,
        salary(i),
        normalizeMoney(i.amount - salary(i)),
        i.payment
      ])
    ];

    download(
      "apostol-income-" + today() + ".csv",
      csv(rows),
      "text/csv;charset=utf-8"
    );
  };

  $("expenseCsv").onclick = () => {
    if (dateRangeInvalid()) {
      alert("Исправьте период дат перед экспортом.");
      return;
    }

    const rows = [
      ["Дата", "Категория", "Комментарий", "Сумма"],
      ...filteredExpenses().map(e => [
        e.date,
        e.category,
        e.comment,
        e.amount
      ])
    ];

    download(
      "apostol-expenses-" + today() + ".csv",
      csv(rows),
      "text/csv;charset=utf-8"
    );
  };

  renderSettings();
  resetIncome();
  resetExpense();
  render();
})();

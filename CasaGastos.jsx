import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Receipt, Wallet, ShoppingCart, ArrowLeftRight, Check, Trash2, X, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'casa-gastos-v1';

const CATEGORIES = [
  { id: 'cuentas', label: 'Cuentas', color: '#1F4B43' },
  { id: 'supermercado', label: 'Supermercado', color: '#D98E04' },
  { id: 'limpieza', label: 'Limpieza', color: '#4D7298' },
  { id: 'otros', label: 'Otros', color: '#C75146' },
];

function catInfo(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[3];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

function monthLabel(key) {
  if (!key) return '';
  const d = new Date(key + '-02T00:00:00');
  const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function seedData() {
  const split5050 = { p1: 50, p2: 50 };
  return {
    people: { p1: 'Tú', p2: 'Roomie' },
    expenses: [
      { id: uid(), description: 'Internet', category: 'cuentas', paidBy: 'p1', date: '2026-06-01', amount: 29990, split: split5050 },
      { id: uid(), description: 'Cuenta de luz', category: 'cuentas', paidBy: 'p1', date: '2026-06-05', amount: 45000, split: split5050 },
      { id: uid(), description: 'Cuenta de agua', category: 'cuentas', paidBy: 'p2', date: '2026-06-05', amount: 18000, split: split5050 },
      { id: uid(), description: 'Supermercado semana 1', category: 'supermercado', paidBy: 'p2', date: '2026-06-08', amount: 35600, split: split5050 },
      { id: uid(), description: 'Gas licuado', category: 'cuentas', paidBy: 'p1', date: '2026-06-10', amount: 22000, split: split5050 },
      { id: uid(), description: 'Productos de limpieza', category: 'limpieza', paidBy: 'p2', date: '2026-06-15', amount: 14500, split: split5050 },
      { id: uid(), description: 'Supermercado semana 3', category: 'supermercado', paidBy: 'p1', date: '2026-06-20', amount: 41200, split: { p1: 60, p2: 40 } },
      { id: uid(), description: 'Internet', category: 'cuentas', paidBy: 'p1', date: '2026-05-01', amount: 29990, split: split5050 },
      { id: uid(), description: 'Cuenta de luz', category: 'cuentas', paidBy: 'p2', date: '2026-05-04', amount: 42000, split: split5050 },
      { id: uid(), description: 'Cuenta de agua', category: 'cuentas', paidBy: 'p1', date: '2026-05-04', amount: 17500, split: split5050 },
      { id: uid(), description: 'Supermercado del mes', category: 'supermercado', paidBy: 'p1', date: '2026-05-12', amount: 68400, split: split5050 },
      { id: uid(), description: 'Artículos de aseo', category: 'limpieza', paidBy: 'p2', date: '2026-05-18', amount: 11200, split: split5050 },
    ],
    shoppingList: [
      { id: uid(), name: 'Pan', category: 'supermercado', estimatedCost: 1500, purchased: false },
      { id: uid(), name: 'Jamón', category: 'supermercado', estimatedCost: 4200, purchased: false },
      { id: uid(), name: 'Queso', category: 'supermercado', estimatedCost: 5500, purchased: false },
      { id: uid(), name: 'Probióticos NUP!', category: 'supermercado', estimatedCost: 6990, purchased: false },
      { id: uid(), name: 'Detergente para ropa', category: 'limpieza', estimatedCost: 7990, purchased: false },
      { id: uid(), name: 'Papel higiénico (paquete)', category: 'limpieza', estimatedCost: 8500, purchased: true },
    ],
  };
}

function calcSettlement(expenses, people) {
  const ids = Object.keys(people);
  const paid = {}; const owed = {};
  ids.forEach((id) => { paid[id] = 0; owed[id] = 0; });
  expenses.forEach((e) => {
    paid[e.paidBy] = (paid[e.paidBy] || 0) + e.amount;
    ids.forEach((id) => {
      const pct = (e.split && e.split[id]) || 0;
      owed[id] += (e.amount * pct) / 100;
    });
  });
  const balance = {};
  ids.forEach((id) => { balance[id] = Math.round(paid[id] - owed[id]); });
  let from = null, to = null;
  ids.forEach((id) => {
    if (balance[id] < 0 && (from === null || balance[id] < balance[from])) from = id;
    if (balance[id] > 0 && (to === null || balance[id] > balance[to])) to = id;
  });
  const amount = from && to ? Math.min(Math.abs(balance[from]), balance[to]) : 0;
  return { paid, owed, balance, from, to, amount: Math.round(amount) };
}

export default function CasaGastosApp() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showShoppingForm, setShowShoppingForm] = useState(false);
  const [purchasingItem, setPurchasingItem] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (mounted) setData(res ? JSON.parse(res.value) : seedData());
      } catch (err) {
        const seed = seedData();
        try { await window.storage.set(STORAGE_KEY, JSON.stringify(seed), true); } catch (e) {}
        if (mounted) setData(seed);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next), true); } catch (e) { console.error(e); }
  }, []);

  const addExpense = (expense) => persist({ ...data, expenses: [...data.expenses, { id: uid(), ...expense }] });
  const deleteExpense = (id) => persist({ ...data, expenses: data.expenses.filter((e) => e.id !== id) });
  const addShoppingItem = (item) => persist({ ...data, shoppingList: [...data.shoppingList, { id: uid(), purchased: false, ...item }] });
  const deleteShoppingItem = (id) => persist({ ...data, shoppingList: data.shoppingList.filter((i) => i.id !== id) });

  const confirmPurchase = (item, paidBy, amount) => {
    const expense = { id: uid(), description: item.name, category: item.category, paidBy, date: todayStr(), amount, split: { p1: 50, p2: 50 } };
    persist({
      ...data,
      expenses: [...data.expenses, expense],
      shoppingList: data.shoppingList.map((i) => (i.id === item.id ? { ...i, purchased: true } : i)),
    });
    setPurchasingItem(null);
  };

  const months = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.expenses.map((e) => e.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data]);

  const currentMonth = selectedMonth || months[0] || todayStr().slice(0, 7);
  const currentIdx = months.indexOf(currentMonth);
  const prevMonth = months[currentIdx + 1];

  const currentExpenses = useMemo(() => (data ? data.expenses.filter((e) => e.date.slice(0, 7) === currentMonth).sort((a, b) => b.date.localeCompare(a.date)) : []), [data, currentMonth]);
  const prevExpenses = useMemo(() => (data ? data.expenses.filter((e) => e.date.slice(0, 7) === prevMonth) : []), [data, prevMonth]);

  const settlement = useMemo(() => (data ? calcSettlement(currentExpenses, data.people) : null), [currentExpenses, data]);

  const categoryTotals = useMemo(() => {
    const totals = {};
    currentExpenses.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    return CATEGORIES.map((c) => ({ name: c.label, value: totals[c.id] || 0, color: c.color })).filter((c) => c.value > 0);
  }, [currentExpenses]);

  const monthComparison = useMemo(() => {
    return CATEGORIES.map((c) => {
      const thisCat = currentExpenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0);
      const prevCat = prevExpenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0);
      return { name: c.label, esteMes: thisCat, mesAnterior: prevCat };
    }).filter((c) => c.esteMes > 0 || c.mesAnterior > 0);
  }, [currentExpenses, prevExpenses]);

  const totalThis = currentExpenses.reduce((s, e) => s + e.amount, 0);
  const totalPrev = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const deltaPct = totalPrev ? Math.round(((totalThis - totalPrev) / totalPrev) * 100) : null;

  const pendingShopping = data ? data.shoppingList.filter((i) => !i.purchased) : [];
  const purchasedShopping = data ? data.shoppingList.filter((i) => i.purchased) : [];
  const estimatedTotal = pendingShopping.reduce((s, i) => s + i.estimatedCost, 0);

  if (loading || !data) {
    return (
      <div className="cg-app cg-loading">
        <style>{baseStyles}</style>
        <div className="cg-spinner" />
        <p>Cargando registro de la casa…</p>
      </div>
    );
  }

  const people = data.people;

  return (
    <div className="cg-app">
      <style>{baseStyles}</style>

      <header className="cg-header">
        <div>
          <p className="cg-eyebrow">Casa · Cuentas compartidas</p>
          <h1 className="cg-title">{monthLabel(currentMonth)}</h1>
        </div>
        <div className="cg-month-nav">
          <button aria-label="Mes anterior" onClick={() => setSelectedMonth(months[currentIdx + 1] || currentMonth)} disabled={currentIdx >= months.length - 1}>
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Mes siguiente" onClick={() => setSelectedMonth(months[currentIdx - 1] || null)} disabled={currentIdx <= 0}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="cg-ticket">
        <div className="cg-ticket-row">
          <span>TICKET DE LIQUIDACIÓN</span>
          <span className="cg-mono">{monthLabel(currentMonth)}</span>
        </div>
        <div className="cg-ticket-divider" />
        {settlement.amount === 0 ? (
          <p className="cg-ticket-balanced"><Check size={16} /> Cuentas al día este mes</p>
        ) : (
          <p className="cg-ticket-debt">
            <strong>{people[settlement.from]}</strong> le debe a <strong>{people[settlement.to]}</strong>
            <span className="cg-mono cg-ticket-amount">{formatCLP(settlement.amount)}</span>
          </p>
        )}
        <div className="cg-ticket-foot">
          {Object.keys(people).map((id) => (
            <span key={id}>{people[id]} pagó <b className="cg-mono">{formatCLP(settlement.paid[id])}</b></span>
          ))}
        </div>
        <div className="cg-zigzag" />
      </div>

      <main className="cg-main">
        {tab === 'dashboard' && (
          <Dashboard
            totalThis={totalThis}
            deltaPct={deltaPct}
            categoryTotals={categoryTotals}
            monthComparison={monthComparison}
            hasPrev={!!prevMonth}
          />
        )}
        {tab === 'gastos' && (
          <Gastos expenses={currentExpenses} people={people} onDelete={deleteExpense} onAdd={() => setShowExpenseForm(true)} />
        )}
        {tab === 'liquidacion' && (
          <Liquidacion months={months} allExpenses={data.expenses} people={people} currentMonth={currentMonth} onSelectMonth={(m) => setSelectedMonth(m)} />
        )}
        {tab === 'compras' && (
          <Compras
            pending={pendingShopping}
            purchased={purchasedShopping}
            estimatedTotal={estimatedTotal}
            onAdd={() => setShowShoppingForm(true)}
            onDelete={deleteShoppingItem}
            onMark={(item) => setPurchasingItem(item)}
          />
        )}
      </main>

      <nav className="cg-nav">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><Wallet size={20} /><span>Resumen</span></button>
        <button className={tab === 'gastos' ? 'active' : ''} onClick={() => setTab('gastos')}><Receipt size={20} /><span>Gastos</span></button>
        <button className={tab === 'liquidacion' ? 'active' : ''} onClick={() => setTab('liquidacion')}><ArrowLeftRight size={20} /><span>Liquidación</span></button>
        <button className={tab === 'compras' ? 'active' : ''} onClick={() => setTab('compras')}><ShoppingCart size={20} /><span>Compras</span></button>
      </nav>

      {(tab === 'gastos' || tab === 'compras') && (
        <button className="cg-fab" onClick={() => (tab === 'gastos' ? setShowExpenseForm(true) : setShowShoppingForm(true))} aria-label="Agregar">
          <Plus size={24} />
        </button>
      )}

      {showExpenseForm && (
        <ExpenseFormModal people={people} onClose={() => setShowExpenseForm(false)} onSave={(exp) => { addExpense(exp); setShowExpenseForm(false); }} />
      )}
      {showShoppingForm && (
        <ShoppingFormModal onClose={() => setShowShoppingForm(false)} onSave={(item) => { addShoppingItem(item); setShowShoppingForm(false); }} />
      )}
      {purchasingItem && (
        <PurchaseModal item={purchasingItem} people={people} onClose={() => setPurchasingItem(null)} onConfirm={confirmPurchase} />
      )}
    </div>
  );
}

function Dashboard({ totalThis, deltaPct, categoryTotals, monthComparison, hasPrev }) {
  return (
    <div className="cg-section">
      <div className="cg-stat-card">
        <p className="cg-stat-label">Total gastado este mes</p>
        <p className="cg-stat-value cg-mono">{formatCLP(totalThis)}</p>
        {hasPrev && deltaPct !== null && (
          <p className={`cg-stat-delta ${deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : ''}`}>
            {deltaPct > 0 ? '+' : ''}{deltaPct}% vs. mes anterior
          </p>
        )}
      </div>

      <h3 className="cg-h3">Por categoría</h3>
      {categoryTotals.length === 0 ? (
        <EmptyState text="Aún no hay gastos registrados este mes. Agrega el primero desde la pestaña Gastos." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryTotals} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
                {categoryTotals.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => formatCLP(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="cg-legend">
            {categoryTotals.map((c, i) => (
              <span key={i} className="cg-legend-item">
                <i style={{ background: c.color }} />{c.name} <b className="cg-mono">{formatCLP(c.value)}</b>
              </span>
            ))}
          </div>
        </>
      )}

      {hasPrev && monthComparison.length > 0 && (
        <>
          <h3 className="cg-h3">Este mes vs. mes anterior</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthComparison} margin={{ top: 8, right: 4, left: -24, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DAD3C2" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B665C' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6B665C' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatCLP(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="mesAnterior" fill="#C9D4C5" radius={[4, 4, 0, 0]} name="Mes anterior" />
              <Bar dataKey="esteMes" fill="#D98E04" radius={[4, 4, 0, 0]} name="Este mes" />
            </BarChart>
          </ResponsiveContainer>
          <div className="cg-legend">
            <span className="cg-legend-item"><i style={{ background: '#C9D4C5' }} />Mes anterior</span>
            <span className="cg-legend-item"><i style={{ background: '#D98E04' }} />Este mes</span>
          </div>
        </>
      )}
    </div>
  );
}

function Gastos({ expenses, people, onDelete }) {
  return (
    <div className="cg-section">
      <h3 className="cg-h3">Movimientos del mes</h3>
      {expenses.length === 0 ? (
        <EmptyState text="No hay gastos este mes todavía. Toca el botón + para registrar el primero." />
      ) : (
        <ul className="cg-list">
          {expenses.map((e) => {
            const cat = catInfo(e.category);
            return (
              <li key={e.id} className="cg-row">
                <span className="cg-cat-dot" style={{ background: cat.color }} />
                <div className="cg-row-main">
                  <p className="cg-row-title">{e.description}</p>
                  <p className="cg-row-sub">{cat.label} · {people[e.paidBy]} pagó · {e.date.split('-').reverse().join('-')}</p>
                </div>
                <div className="cg-row-end">
                  <span className="cg-mono cg-row-amount">{formatCLP(e.amount)}</span>
                  <button className="cg-icon-btn" aria-label="Eliminar" onClick={() => onDelete(e.id)}><Trash2 size={15} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Liquidacion({ months, allExpenses, people, currentMonth, onSelectMonth }) {
  const current = calcSettlement(allExpenses.filter((e) => e.date.slice(0, 7) === currentMonth), people);
  const history = months.filter((m) => m !== currentMonth).map((m) => ({
    month: m,
    settlement: calcSettlement(allExpenses.filter((e) => e.date.slice(0, 7) === m), people),
  }));

  return (
    <div className="cg-section">
      <h3 className="cg-h3">Detalle de {monthLabel(currentMonth)}</h3>
      <div className="cg-detail-card">
        {Object.keys(people).map((id) => (
          <div key={id} className="cg-detail-row">
            <span>{people[id]}</span>
            <span className="cg-mono">pagó {formatCLP(current.paid[id])} · le tocaba {formatCLP(current.owed[id])}</span>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <>
          <h3 className="cg-h3">Historial de meses</h3>
          <ul className="cg-list">
            {history.map(({ month, settlement }) => (
              <li key={month} className="cg-row cg-row-click" onClick={() => onSelectMonth(month)}>
                <div className="cg-row-main">
                  <p className="cg-row-title">{monthLabel(month)}</p>
                  <p className="cg-row-sub">
                    {settlement.amount === 0
                      ? 'Cuentas saldadas'
                      : `${people[settlement.from]} debía a ${people[settlement.to]}`}
                  </p>
                </div>
                <div className="cg-row-end">
                  {settlement.amount > 0 && <span className="cg-mono cg-row-amount">{formatCLP(settlement.amount)}</span>}
                  <ArrowRight size={15} color="#6B665C" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Compras({ pending, purchased, estimatedTotal, onAdd, onDelete, onMark }) {
  return (
    <div className="cg-section">
      <div className="cg-stat-card">
        <p className="cg-stat-label">Estimado de la lista pendiente</p>
        <p className="cg-stat-value cg-mono">{formatCLP(estimatedTotal)}</p>
      </div>

      <h3 className="cg-h3">Por comprar</h3>
      {pending.length === 0 ? (
        <EmptyState text="La lista está vacía. Agrega lo que falte para el depto con el botón +." />
      ) : (
        <ul className="cg-list">
          {pending.map((item) => {
            const cat = catInfo(item.category);
            return (
              <li key={item.id} className="cg-row">
                <span className="cg-cat-dot" style={{ background: cat.color }} />
                <div className="cg-row-main">
                  <p className="cg-row-title">{item.name}</p>
                  <p className="cg-row-sub">{cat.label} · est. <span className="cg-mono">{formatCLP(item.estimatedCost)}</span></p>
                </div>
                <div className="cg-row-end">
                  <button className="cg-icon-btn cg-icon-btn-accent" aria-label="Marcar comprado" onClick={() => onMark(item)}><Check size={15} /></button>
                  <button className="cg-icon-btn" aria-label="Eliminar" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {purchased.length > 0 && (
        <>
          <h3 className="cg-h3">Ya comprado</h3>
          <ul className="cg-list">
            {purchased.map((item) => (
              <li key={item.id} className="cg-row cg-row-done">
                <Check size={15} color="#2F7D5C" />
                <div className="cg-row-main">
                  <p className="cg-row-title">{item.name}</p>
                </div>
                <span className="cg-mono cg-row-amount">{formatCLP(item.estimatedCost)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="cg-empty">{text}</p>;
}

function ExpenseFormModal({ people, onClose, onSave }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [paidBy, setPaidBy] = useState('p1');
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [splitMode, setSplitMode] = useState('5050');
  const [payerPct, setPayerPct] = useState(50);

  const split = splitMode === '5050' ? { p1: 50, p2: 50 } : { [paidBy]: payerPct, [paidBy === 'p1' ? 'p2' : 'p1']: 100 - payerPct };

  const valid = description.trim() && amount && Number(amount) > 0;

  return (
    <div className="cg-modal-backdrop" onClick={onClose}>
      <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cg-modal-head">
          <h3>Nuevo gasto</h3>
          <button className="cg-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <label className="cg-field">
          <span>Qué se compró</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Cuenta de luz" />
        </label>

        <label className="cg-field">
          <span>Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>

        <div className="cg-field-row">
          <label className="cg-field">
            <span>Quién pagó</span>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {Object.keys(people).map((id) => <option key={id} value={id}>{people[id]}</option>)}
            </select>
          </label>
          <label className="cg-field">
            <span>Fecha</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <label className="cg-field">
          <span>Monto (CLP)</span>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </label>

        <div className="cg-field">
          <span>División del gasto</span>
          <div className="cg-toggle">
            <button className={splitMode === '5050' ? 'active' : ''} onClick={() => setSplitMode('5050')}>50 / 50</button>
            <button className={splitMode === 'custom' ? 'active' : ''} onClick={() => setSplitMode('custom')}>Personalizado</button>
          </div>
          {splitMode === 'custom' && (
            <div className="cg-split-custom">
              <span>{people[paidBy]} paga</span>
              <input type="range" min="0" max="100" value={payerPct} onChange={(e) => setPayerPct(Number(e.target.value))} />
              <span className="cg-mono">{payerPct}% / {100 - payerPct}%</span>
            </div>
          )}
        </div>

        <button className="cg-submit" disabled={!valid} onClick={() => onSave({ description: description.trim(), category, paidBy, date, amount: Number(amount), split })}>
          Guardar gasto
        </button>
      </div>
    </div>
  );
}

function ShoppingFormModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1].id);
  const [estimatedCost, setEstimatedCost] = useState('');
  const valid = name.trim() && estimatedCost && Number(estimatedCost) > 0;

  return (
    <div className="cg-modal-backdrop" onClick={onClose}>
      <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cg-modal-head">
          <h3>Agregar a la lista</h3>
          <button className="cg-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="cg-field">
          <span>Artículo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Detergente" />
        </label>
        <label className="cg-field">
          <span>Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="cg-field">
          <span>Costo estimado (CLP)</span>
          <input type="number" inputMode="numeric" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="0" />
        </label>
        <button className="cg-submit" disabled={!valid} onClick={() => onSave({ name: name.trim(), category, estimatedCost: Number(estimatedCost) })}>
          Agregar a la lista
        </button>
      </div>
    </div>
  );
}

function PurchaseModal({ item, people, onClose, onConfirm }) {
  const [paidBy, setPaidBy] = useState('p1');
  const [amount, setAmount] = useState(item.estimatedCost);

  return (
    <div className="cg-modal-backdrop" onClick={onClose}>
      <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cg-modal-head">
          <h3>Marcar como comprado</h3>
          <button className="cg-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="cg-modal-sub">{item.name} pasará al registro de gastos del mes.</p>
        <label className="cg-field">
          <span>Quién pagó</span>
          <div className="cg-toggle">
            {Object.keys(people).map((id) => (
              <button key={id} className={paidBy === id ? 'active' : ''} onClick={() => setPaidBy(id)}>{people[id]}</button>
            ))}
          </div>
        </label>
        <label className="cg-field">
          <span>Monto final (CLP)</span>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </label>
        <button className="cg-submit" onClick={() => onConfirm(item, paidBy, amount)}>Confirmar compra</button>
      </div>
    </div>
  );
}

const baseStyles = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

.cg-app { --bg:#EAF0E9; --paper:#F7FAF5; --ink:#1B2B22; --ink-soft:#5C6B5F; --accent:#D98E04; --teal:#1F4B43; --positive:#2F7D5C; --negative:#C9542C; --line:#C9D4C5;
  font-family:'Inter',sans-serif; background:var(--bg); color:var(--ink); max-width:480px; margin:0 auto; min-height:100vh; padding-bottom:84px; position:relative; }
.cg-app * { box-sizing:border-box; }
.cg-mono { font-family:'JetBrains Mono',monospace; }
.cg-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; min-height:60vh; color:var(--ink-soft); font-size:13px; }
.cg-spinner { width:24px; height:24px; border-radius:50%; border:3px solid var(--line); border-top-color:var(--accent); animation:cgspin .8s linear infinite; }
@keyframes cgspin { to { transform:rotate(360deg); } }

.cg-header { display:flex; align-items:flex-end; justify-content:space-between; padding:20px 18px 4px; }
.cg-eyebrow { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-soft); margin:0 0 2px; }
.cg-title { font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700; margin:0; }
.cg-month-nav { display:flex; gap:6px; }
.cg-month-nav button { width:32px; height:32px; border-radius:8px; border:1px solid var(--line); background:var(--paper); display:flex; align-items:center; justify-content:center; color:var(--ink); }
.cg-month-nav button:disabled { opacity:.35; }

.cg-ticket { margin:14px 18px 4px; background:var(--paper); border:1px solid var(--line); border-radius:10px 10px 0 0; padding:16px 18px 22px; position:relative; }
.cg-ticket-row { display:flex; justify-content:space-between; font-size:10.5px; letter-spacing:.05em; color:var(--ink-soft); text-transform:uppercase; }
.cg-ticket-divider { border-top:1px dashed var(--line); margin:10px 0; }
.cg-ticket-balanced { display:flex; align-items:center; gap:6px; color:var(--positive); font-weight:500; font-size:14px; margin:4px 0; }
.cg-ticket-debt { font-size:14px; line-height:1.6; margin:4px 0; }
.cg-ticket-amount { display:block; font-size:24px; font-weight:600; color:var(--negative); margin-top:2px; }
.cg-ticket-foot { display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-soft); margin-top:10px; }
.cg-zigzag { position:absolute; left:0; right:0; bottom:-9px; height:9px;
  background:linear-gradient(135deg,var(--bg) 50%,transparent 50%) 0 0/12px 12px,linear-gradient(-135deg,var(--bg) 50%,transparent 50%) 0 0/12px 12px;
  background-color:var(--paper); }

.cg-main { padding:18px; }
.cg-section { display:flex; flex-direction:column; gap:14px; }
.cg-h3 { font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:700; margin:6px 0 0; }

.cg-stat-card { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px 18px; }
.cg-stat-label { font-size:12px; color:var(--ink-soft); margin:0 0 4px; }
.cg-stat-value { font-size:26px; font-weight:600; margin:0; }
.cg-stat-delta { font-size:12px; margin:6px 0 0; color:var(--ink-soft); }
.cg-stat-delta.up { color:var(--negative); }
.cg-stat-delta.down { color:var(--positive); }

.cg-legend { display:flex; flex-wrap:wrap; gap:10px 16px; font-size:12px; color:var(--ink-soft); }
.cg-legend-item { display:flex; align-items:center; gap:6px; }
.cg-legend-item i { width:9px; height:9px; border-radius:2px; display:inline-block; }
.cg-legend-item b { color:var(--ink); font-weight:500; }

.cg-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1px; background:var(--line); border-radius:10px; overflow:hidden; }
.cg-row { display:flex; align-items:center; gap:10px; background:var(--paper); padding:12px 14px; }
.cg-row-click { cursor:pointer; }
.cg-cat-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.cg-row-main { flex:1; min-width:0; }
.cg-row-title { font-size:13.5px; font-weight:500; margin:0; }
.cg-row-sub { font-size:11.5px; color:var(--ink-soft); margin:2px 0 0; }
.cg-row-end { display:flex; align-items:center; gap:6px; }
.cg-row-amount { font-size:13px; font-weight:500; }
.cg-row-done { opacity:.6; }
.cg-row-done .cg-row-title { text-decoration:line-through; }

.cg-icon-btn { width:28px; height:28px; border-radius:7px; border:1px solid var(--line); background:transparent; display:flex; align-items:center; justify-content:center; color:var(--ink-soft); flex-shrink:0; }
.cg-icon-btn-accent { color:var(--positive); border-color:var(--positive); }

.cg-empty { font-size:13px; color:var(--ink-soft); background:var(--paper); border:1px dashed var(--line); border-radius:10px; padding:20px; text-align:center; }

.cg-detail-card { background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:4px 16px; }
.cg-detail-row { display:flex; justify-content:space-between; font-size:12.5px; padding:10px 0; border-bottom:1px solid var(--line); }
.cg-detail-row:last-child { border-bottom:none; }

.cg-nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:480px; display:flex; background:var(--paper); border-top:1px solid var(--line); padding:6px 4px 10px; }
.cg-nav button { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none; color:var(--ink-soft); font-size:10.5px; padding:6px 0; }
.cg-nav button.active { color:var(--teal); font-weight:500; }

.cg-fab { position:fixed; bottom:78px; left:50%; transform:translateX(146px); width:52px; height:52px; border-radius:50%; background:var(--accent); color:#fff; border:none; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,.18); }

.cg-modal-backdrop { position:fixed; inset:0; background:rgba(27,43,34,.45); display:flex; align-items:flex-end; justify-content:center; z-index:50; }
.cg-modal { background:var(--paper); width:100%; max-width:480px; border-radius:16px 16px 0 0; padding:20px 18px 28px; max-height:88vh; overflow-y:auto; }
.cg-modal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.cg-modal-head h3 { font-family:'Space Grotesk',sans-serif; font-size:16px; margin:0; }
.cg-modal-sub { font-size:12.5px; color:var(--ink-soft); margin:-6px 0 14px; }

.cg-field { display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-soft); margin-bottom:12px; flex:1; }
.cg-field-row { display:flex; gap:10px; }
.cg-field input, .cg-field select { font-family:'Inter',sans-serif; font-size:14px; color:var(--ink); background:#fff; border:1px solid var(--line); border-radius:8px; padding:9px 10px; }

.cg-toggle { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.cg-toggle button { flex:1; background:#fff; border:none; padding:9px 0; font-size:12.5px; color:var(--ink-soft); border-right:1px solid var(--line); }
.cg-toggle button:last-child { border-right:none; }
.cg-toggle button.active { background:var(--teal); color:#fff; }

.cg-split-custom { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:12px; color:var(--ink-soft); }
.cg-split-custom input[type=range] { flex:1; }

.cg-submit { width:100%; background:var(--teal); color:#fff; border:none; border-radius:9px; padding:13px 0; font-size:14px; font-weight:500; margin-top:4px; }
.cg-submit:disabled { opacity:.4; }
`;

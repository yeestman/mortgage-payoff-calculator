import { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { calcMonthlyPayment, runScenarios } from './mortgage';

// ============================================================
// FORMAT HELPERS
// ============================================================
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtFull = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ============================================================
// REUSABLE COMPONENTS
// ============================================================
function StatCard({ label, value, sub, color = 'text-sky-400' }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
      <div className={`text-2xl md:text-3xl font-extrabold ${color}`}>{value}</div>
      <div className="text-slate-400 text-xs mt-1 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step, format, suffix = '' }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <label className="text-sm text-slate-400">{label}</label>
        <span className="text-sm font-semibold text-slate-200">
          {format ? format(value) : value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-slate-600">
        <span>{format ? format(min) : min}{suffix}</span>
        <span>{format ? format(max) : max}{suffix}</span>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min = 0, max, step = 1, prefix = '', suffix = '' }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-400">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{prefix}</span>
        )}
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 ${prefix ? 'pl-7 pr-3' : 'px-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, className = '' }) {
  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 ${className}`}>
      {title && <h2 className="text-lg font-semibold text-slate-100 mb-4">{title}</h2>}
      {children}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
            i === active
              ? 'bg-sky-500 text-white border-sky-500'
              : 'bg-transparent text-slate-400 border-slate-700 hover:border-sky-500 hover:text-slate-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// CUSTOM TOOLTIP
// ============================================================
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ============================================================
// AMORTIZATION TABLE
// ============================================================
function AmortTable({ schedule, label }) {
  const [expanded, setExpanded] = useState(false);

  const rows = expanded
    ? schedule
    : schedule.filter((_, i) => i % 6 === 0 || i === schedule.length - 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-slate-300">{label}</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          {expanded ? 'Show summary' : 'Show all months'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b-2 border-slate-700">
              <th className="text-left py-2 px-2">Month</th>
              <th className="text-right py-2 px-2">Payment</th>
              <th className="text-right py-2 px-2">Principal</th>
              <th className="text-right py-2 px-2">Interest</th>
              <th className="text-right py-2 px-2">Balance</th>
              <th className="text-right py-2 px-2">Total Interest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.month}
                className={`border-b border-slate-800 hover:bg-slate-800/50 ${
                  r.balance < 0.01 ? 'text-amber-400 font-semibold' : 'text-slate-300'
                }`}
              >
                <td className="py-1.5 px-2">{r.month}</td>
                <td className="text-right py-1.5 px-2">{fmtFull(r.payment)}</td>
                <td className="text-right py-1.5 px-2">{fmtFull(r.principal)}</td>
                <td className="text-right py-1.5 px-2">{fmtFull(r.interest)}</td>
                <td className="text-right py-1.5 px-2">{fmtFull(r.balance)}</td>
                <td className="text-right py-1.5 px-2">{fmtFull(r.totalInterest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  // Loan inputs
  const [originalAmount, setOriginalAmount] = useState(200000);
  const [annualRate, setAnnualRate] = useState(4.75);
  const [termYears, setTermYears] = useState(30);
  const [currentBalance, setCurrentBalance] = useState(136956.97);
  const [monthsElapsed, setMonthsElapsed] = useState(127);
  const [extraPerDay, setExtraPerDay] = useState(150);

  // Chart controls
  const [activeRateTab, setActiveRateTab] = useState(1); // default 7%
  const [activeAmortTab, setActiveAmortTab] = useState(0);

  // Editable return rates
  const [rate1, setRate1] = useState(5);
  const [rate2, setRate2] = useState(7);
  const [rate3, setRate3] = useState(10);

  const returnRates = [rate1 / 100, rate2 / 100, rate3 / 100];
  const returnLabels = [`${rate1}% Return`, `${rate2}% Return`, `${rate3}% Return`];

  const extraPerMonth = extraPerDay * 365.25 / 12;
  const termMonths = termYears * 12;
  const monthlyPayment = calcMonthlyPayment(originalAmount, annualRate / 100, termMonths);

  const data = useMemo(() => {
    if (currentBalance <= 0 || annualRate <= 0 || termMonths <= monthsElapsed) return null;
    return runScenarios({
      currentBalance,
      annualRate: annualRate / 100,
      originalTermMonths: termMonths,
      monthsElapsed,
      extraPerMonth,
      monthlyPayment,
      returnRates,
    });
  }, [currentBalance, annualRate, termMonths, monthsElapsed, extraPerMonth, monthlyPayment]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Enter valid loan parameters to see results.</p>
      </div>
    );
  }

  // Prepare timeline chart data (sampled to avoid too many points)
  const timeline = data.timelines[activeRateTab];
  const step = Math.max(1, Math.floor(timeline.length / 120));
  const chartData = timeline
    .filter((_, i) => i % step === 0 || i === timeline.length - 1)
    .map((d) => ({
      label: `Mo ${d.month}`,
      'Early Payoff': d.netA,
      'Invest First': d.netB,
    }));

  // Bar chart data
  const barData = data.results.map((r) => ({
    name: `${(r.rate * 100).toFixed(0)}%`,
    'Early Payoff': Math.round(r.finalA),
    'Invest First': Math.round(r.finalB),
  }));

  // Mortgage balance chart
  const maxMortMonths = Math.max(data.scheduleA.length, data.scheduleB.length);
  const mortStep = Math.max(1, Math.floor(maxMortMonths / 80));
  const mortData = [];
  for (let m = 0; m <= maxMortMonths; m += mortStep) {
    mortData.push({
      label: `Mo ${m}`,
      'Accelerated': m === 0 ? currentBalance : (m <= data.scheduleA.length ? Math.round(data.scheduleA[m - 1].balance) : 0),
      'On Schedule': m === 0 ? currentBalance : (m <= data.scheduleB.length ? Math.round(data.scheduleB[m - 1].balance) : 0),
    });
  }
  if (mortData[mortData.length - 1].label !== `Mo ${maxMortMonths}`) {
    mortData.push({
      label: `Mo ${maxMortMonths}`,
      'Accelerated': 0,
      'On Schedule': 0,
    });
  }

  const payoffYears = Math.floor(data.payoffMonthsA / 12);
  const payoffMo = data.payoffMonthsA % 12;
  const remainYears = Math.floor(data.remainingMonths / 12);
  const remainMo = data.remainingMonths % 12;

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-50">Mortgage Payoff Calculator</h1>
        <p className="text-slate-500 text-sm mt-1">Early Payoff + Invest vs. On-Schedule + Invest from Day One</p>
      </div>

      {/* Input Panel */}
      <Section title="Loan Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumberInput label="Original Loan Amount" value={originalAmount} onChange={setOriginalAmount} prefix="$" step={1000} />
          <NumberInput label="Interest Rate (%)" value={annualRate} onChange={setAnnualRate} suffix="%" step={0.125} min={0.125} max={15} />
          <NumberInput label="Loan Term (years)" value={termYears} onChange={setTermYears} suffix="yr" min={1} max={40} />
          <NumberInput label="Current Balance" value={currentBalance} onChange={setCurrentBalance} prefix="$" step={100} />
          <NumberInput label="Months Elapsed" value={monthsElapsed} onChange={setMonthsElapsed} min={0} max={termMonths - 1} />
        </div>
        <div className="mt-5 pt-4 border-t border-slate-800">
          <SliderInput
            label="Extra Payment Per Day"
            value={extraPerDay}
            onChange={setExtraPerDay}
            min={0} max={500} step={5}
            format={(v) => `$${v}`}
            suffix="/day"
          />
          <p className="text-xs text-slate-600 mt-1">= {fmt(extraPerMonth)}/month</p>
        </div>
      </Section>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Monthly Payment" value={fmt(monthlyPayment)} color="text-sky-400" />
        <StatCard label="Extra / Month" value={fmt(extraPerMonth)} sub={`$${extraPerDay}/day`} color="text-emerald-400" />
        <StatCard
          label="Early Payoff In"
          value={`${payoffYears}y ${payoffMo}m`}
          sub={`vs ${remainYears}y ${remainMo}m scheduled`}
          color="text-amber-400"
        />
        <StatCard label="Interest Saved" value={fmt(data.interestSaved)} color="text-emerald-400" />
      </div>

      {/* Scenario Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section>
          <div className="inline-block bg-amber-500/15 text-amber-400 text-xs font-semibold px-3 py-0.5 rounded-full mb-3">
            Scenario A — Early Payoff
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Monthly towards mortgage" value={fmt(monthlyPayment + extraPerMonth)} />
            <Row label="Payoff time" value={`${data.payoffMonthsA} months`} valueClass="text-emerald-400" />
            <Row label="Total interest paid" value={fmt(data.totalInterestA)} />
            <Row label="Then invest/month" value={fmt(data.investContribA)} />
            <Row label="Investment period" value={`${data.investMonthsA} months`} />
          </div>
        </Section>
        <Section>
          <div className="inline-block bg-sky-500/15 text-sky-400 text-xs font-semibold px-3 py-0.5 rounded-full mb-3">
            Scenario B — Invest First
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Monthly towards mortgage" value={fmt(monthlyPayment)} />
            <Row label="Payoff time" value={`${data.payoffMonthsB} months`} />
            <Row label="Total interest paid" value={fmt(data.totalInterestB)} valueClass="text-red-400" />
            <Row label="Investing/month" value={fmt(extraPerMonth)} />
            <Row label="Investment period" value={`${data.remainingMonths} months`} valueClass="text-sky-400" />
          </div>
        </Section>
      </div>

      {/* Results by return rate */}
      <Section title="Final Portfolio at End of Original Loan Term">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {data.results.map((r, i) => {
            const diff = r.finalA - r.finalB;
            const rateSetters = [setRate1, setRate2, setRate3];
            const rateValues = [rate1, rate2, rate3];
            return (
              <div key={i} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={rateValues[i]}
                      onChange={(e) => rateSetters[i](parseFloat(e.target.value) || 0)}
                      min={0} max={30} step={0.5}
                      className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-sm font-semibold text-slate-200 text-center focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="text-sm text-slate-400">% Return</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    r.winner === 'A'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-sky-500/20 text-sky-400'
                  }`}>
                    {r.winner === 'A' ? 'EARLY PAYOFF' : 'INVEST FIRST'}
                  </span>
                </div>
                <Row label="Early Payoff" value={fmt(r.finalA)} valueClass="text-amber-400" />
                <Row label="Invest First" value={fmt(r.finalB)} valueClass="text-sky-400" />
                <Row
                  label="Difference"
                  value={`${diff > 0 ? '+' : ''}${fmt(diff)}`}
                  valueClass={diff > 0 ? 'text-emerald-400' : 'text-red-400'}
                />
              </div>
            );
          })}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar dataKey="Early Payoff" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Invest First" fill="#38bdf8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Net Worth Timeline */}
      <Section title="Net Worth Over Time">
        <TabBar tabs={returnLabels} active={activeRateTab} onChange={setActiveRateTab} />
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="Early Payoff" stroke="#f59e0b" fill="url(#gradA)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Invest First" stroke="#38bdf8" fill="url(#gradB)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* Mortgage Balance Chart */}
      <Section title="Mortgage Balance Over Time">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={mortData}>
            <defs>
              <linearGradient id="gradMA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradMB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="Accelerated" stroke="#f59e0b" fill="url(#gradMA)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="On Schedule" stroke="#38bdf8" fill="url(#gradMB)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* Amortization Tables */}
      <Section title="Amortization Schedule">
        <TabBar
          tabs={['Early Payoff (Accelerated)', 'On Schedule']}
          active={activeAmortTab}
          onChange={setActiveAmortTab}
        />
        {activeAmortTab === 0 ? (
          <AmortTable schedule={data.scheduleA} label="Scenario A — Accelerated Payoff" />
        ) : (
          <AmortTable schedule={data.scheduleB} label="Scenario B — On Schedule" />
        )}
      </Section>

      {/* Footer */}
      <p className="text-center text-xs text-slate-600 pb-4">
        Investment returns compounded monthly (end-of-month contributions). No taxes, fees, or inflation adjustments.
        Extra payment = ${extraPerDay}/day averaged to {fmt(extraPerMonth)}/month.
      </p>
    </div>
  );
}

function Row({ label, value, valueClass = 'text-slate-200' }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`font-semibold text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}

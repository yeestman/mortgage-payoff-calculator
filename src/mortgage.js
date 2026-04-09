// ============================================================
// MORTGAGE CALCULATION ENGINE
// ============================================================

export function calcMonthlyPayment(principal, annualRate, termMonths) {
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export function amortize(balance, monthlyRate, payment, extraMonthly = 0) {
  const schedule = [];
  let b = balance;
  let totalInterest = 0;
  let month = 0;

  while (b > 0.01 && month < 600) {
    month++;
    const interest = b * monthlyRate;
    const principalBase = Math.min(payment - interest, b);
    const extra = Math.min(extraMonthly, b - principalBase);
    const principal = principalBase + extra;
    b = Math.max(0, b - principal);
    totalInterest += interest;

    schedule.push({
      month,
      payment: interest + principal,
      principal,
      interest,
      extra: Math.min(extraMonthly, extra),
      balance: b,
      totalInterest,
    });

    if (b <= 0) break;
  }
  return schedule;
}

export function investmentGrowth(monthlyContribution, months, annualReturn) {
  const r = annualReturn / 12;
  let balance = 0;
  const history = [];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) + monthlyContribution;
    history.push({ month: m, balance, contributed: monthlyContribution * m });
  }
  return history;
}

export function runScenarios({
  currentBalance,
  annualRate,
  originalTermMonths,
  monthsElapsed,
  extraPerMonth,
  monthlyPayment,
  returnRates,
}) {
  const monthlyRate = annualRate / 12;
  const remainingMonths = originalTermMonths - monthsElapsed;

  // Scenario A: Pay off early with extra, then invest everything
  const scheduleA = amortize(currentBalance, monthlyRate, monthlyPayment, extraPerMonth);
  const payoffMonthsA = scheduleA.length;
  const totalInterestA = scheduleA[scheduleA.length - 1].totalInterest;

  const investMonthsA = Math.max(0, remainingMonths - payoffMonthsA);
  const investContribA = monthlyPayment + extraPerMonth;

  // Scenario B: Pay on schedule, invest extra from day one
  const scheduleB = amortize(currentBalance, monthlyRate, monthlyPayment, 0);
  const payoffMonthsB = scheduleB.length;
  const totalInterestB = scheduleB[scheduleB.length - 1].totalInterest;

  const interestSaved = totalInterestB - totalInterestA;

  // Calculate for each return rate
  const results = returnRates.map((rate) => {
    const investA = investMonthsA > 0 ? investmentGrowth(investContribA, investMonthsA, rate) : [];
    const finalA = investA.length > 0 ? investA[investA.length - 1].balance : 0;

    const investB = investmentGrowth(extraPerMonth, remainingMonths, rate);
    const finalB = investB.length > 0 ? investB[investB.length - 1].balance : 0;

    return {
      rate,
      finalA,
      finalB,
      difference: finalA - finalB,
      winner: finalA > finalB ? 'A' : 'B',
    };
  });

  // Build month-by-month timeline for each rate
  const timelines = returnRates.map((rate) => {
    const monthlyReturn = rate / 12;
    const timeline = [];
    let balMortA = currentBalance;
    let balInvestA = 0;
    let balMortB = currentBalance;
    let balInvestB = 0;
    let mortPaidA = false;

    for (let m = 1; m <= remainingMonths; m++) {
      // Scenario A
      if (!mortPaidA && balMortA > 0.01) {
        const intA = balMortA * monthlyRate;
        const princBaseA = Math.min(monthlyPayment - intA, balMortA);
        const extraA = Math.min(extraPerMonth, balMortA - princBaseA);
        balMortA = Math.max(0, balMortA - princBaseA - extraA);
        if (balMortA <= 0.01) { mortPaidA = true; balMortA = 0; }
      } else {
        balInvestA = balInvestA * (1 + monthlyReturn) + investContribA;
      }

      // Scenario B
      if (balMortB > 0.01) {
        const intB = balMortB * monthlyRate;
        const princB = Math.min(monthlyPayment - intB, balMortB);
        balMortB = Math.max(0, balMortB - princB);
      }
      balInvestB = balInvestB * (1 + monthlyReturn) + extraPerMonth;

      timeline.push({
        month: m,
        investA: Math.round(balInvestA),
        investB: Math.round(balInvestB),
        mortA: Math.round(balMortA),
        mortB: Math.round(balMortB),
        netA: Math.round(balInvestA - balMortA),
        netB: Math.round(balInvestB - balMortB),
      });
    }
    return timeline;
  });

  return {
    monthlyPayment,
    remainingMonths,
    scheduleA,
    scheduleB,
    payoffMonthsA,
    payoffMonthsB,
    totalInterestA,
    totalInterestB,
    interestSaved,
    investMonthsA,
    investContribA,
    results,
    timelines,
  };
}

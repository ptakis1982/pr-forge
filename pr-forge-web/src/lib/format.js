export function kg(weight, unit) {
  return unit === "lb" ? Number(weight) * 0.45359237 : Number(weight);
}

export function displayWeight(weightKg, unit = "kg") {
  if (!Number.isFinite(Number(weightKg))) return "-";
  if (unit === "lb") return `${Math.round(Number(weightKg) / 0.45359237)} lb`;
  return `${Math.round(Number(weightKg) * 10) / 10} kg`;
}

export function displayDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = String(isoDate).split("-");
  if (!year || !month || !day) return String(isoDate);
  return `${year}-${month}-${day}`;
}

export function estimatedMaxKg(normalizedWeightKg, reps, percentage) {
  const pct = Number(percentage);
  if (pct > 0) return Number(normalizedWeightKg) / (pct / 100);
  if (Number(reps) <= 1) return Number(normalizedWeightKg);
  return Number(normalizedWeightKg) * (1 + Number(reps) / 30);
}

/** True when `d` (any Date-parseable string) falls on the same LOCAL calendar day as now. */
export function isTodayDate(d?: string): boolean {
  if (!d) return false;
  const x = new Date(d);
  const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
}

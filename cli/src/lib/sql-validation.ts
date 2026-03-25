/** Mirrors app/api/cli/query/route.ts validation. */

export function validateQuery(sql: string): { valid: true; sanitized: string } | { valid: false; error: string } {
  const trimmed = sql.trim();

  if (!/^select\b/i.test(trimmed)) {
    return { valid: false, error: "Only SELECT queries allowed" };
  }

  if (trimmed.replace(/'[^']*'/g, "").includes(";")) {
    return { valid: false, error: "Multiple statements not allowed" };
  }

  if (/\b(drop|delete|insert|update|alter|create|truncate|grant|revoke)\b/i.test(trimmed)) {
    return { valid: false, error: "Only SELECT queries are permitted" };
  }

  return { valid: true, sanitized: trimmed };
}

export function ensureLimitClause(sql: string, limit: number): string {
  const capped = Math.min(Math.max(limit, 1), 10000);
  if (/\blimit\b/i.test(sql) || /\bfetch\b/i.test(sql)) {
    return sql;
  }
  return `${sql} LIMIT ${capped}`;
}

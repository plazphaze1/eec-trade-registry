const MAX_SEARCH_LENGTH = 100;
const CATEGORY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/;
const MAX_PAGE = 10000;

export interface CatalogueQuery {
  category: string | null;
  page: number;
  search: string | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function normalizeSearch(value: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized ? normalized.slice(0, MAX_SEARCH_LENGTH) : null;
}

export function normalizeCategory(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return CATEGORY_PATTERN.test(normalized) ? normalized : null;
}

export function normalizePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_PAGE)
    : 1;
}

export function parseCatalogueQuery(params: SearchParams): CatalogueQuery {
  return {
    category: normalizeCategory(firstValue(params.category)),
    page: normalizePage(firstValue(params.page)),
    search: normalizeSearch(firstValue(params.q)),
  };
}

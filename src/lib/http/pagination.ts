/** Phân trang offset (bắt buộc ở mọi list endpoint — bài học #8). */
export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePagination(req: Request): PageParams {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const rawSize = Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  const search = url.searchParams.get("search")?.trim() || undefined;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, search };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginated<T>(
  items: T[],
  total: number,
  p: PageParams,
): Paginated<T> {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    totalPages: Math.ceil(total / p.pageSize),
  };
}

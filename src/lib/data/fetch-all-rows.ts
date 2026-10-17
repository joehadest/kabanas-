interface RowsPage<T> {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
}

/** Fetch every page, including when the API caps responses below our page size. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<RowsPage<T>>
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;

  while (true) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Não foi possível carregar o histórico do relatório.');
    if (!data.length) {
      if (count !== null && rows.length < count) {
        throw new Error('O histórico do relatório está incompleto. Tente novamente.');
      }
      return rows;
    }

    rows.push(...data);
    if (count !== null && rows.length >= count) return rows;
  }
}

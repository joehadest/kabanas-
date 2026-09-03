import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DineInState {
  tableId: string | null;
  customerName: string;
  setTableId: (tableId: string | null) => void;
  setCustomerName: (name: string) => void;
}

/**
 * Lembra a última mesa/nome usados neste aparelho, só como conveniência de
 * preenchimento — a mesa sempre precisa ser confirmada pelo cliente antes de
 * enviar um novo pedido (não usamos isso para vincular pedidos automaticamente).
 */
export const useDineInStore = create<DineInState>()(
  persist(
    (set) => ({
      tableId: null,
      customerName: '',
      setTableId: (tableId) => set({ tableId }),
      setCustomerName: (customerName) => set({ customerName }),
    }),
    {
      name: 'kabanas-dine-in',
      skipHydration: true,
    }
  )
);

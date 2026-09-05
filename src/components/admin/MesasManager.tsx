'use client';

import { Panel } from '@/components/ui/page-layout';
import { CustomerOrderingToggle } from './CustomerOrderingToggle';
import { MenuQrCode } from './MenuQrCode';
import { TablesEditor, type TableArea, type TableRow } from './TablesEditor';

interface Props {
  storeId: string;
  storeSlug: string;
  menuUrl: string;
  areas: TableArea[];
  tables: TableRow[];
  customerOrderingEnabled: boolean;
}

export function MesasManager({ storeId, storeSlug, menuUrl, areas, tables, customerOrderingEnabled }: Props) {
  return (
    <div className="space-y-6">
      <Panel title="Cardápio do cliente" eyebrow="QR Code geral">
        <div className="space-y-4">
          <CustomerOrderingToggle storeId={storeId} initialEnabled={customerOrderingEnabled} />
          <MenuQrCode url={menuUrl} storeSlug={storeSlug} />
        </div>
      </Panel>

      <TablesEditor storeId={storeId} areas={areas} tables={tables} onUpdate={() => {}} />
    </div>
  );
}

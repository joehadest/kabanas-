'use client';

import { Panel } from '@/components/ui/page-layout';
import { MenuQrCode } from './MenuQrCode';
import { TablesEditor, type TableArea, type TableRow } from './TablesEditor';

interface Props {
  storeId: string;
  storeSlug: string;
  menuUrl: string;
  areas: TableArea[];
  tables: TableRow[];
}

export function MesasManager({ storeId, storeSlug, menuUrl, areas, tables }: Props) {
  return (
    <div className="space-y-6">
      <Panel title="Cardápio do cliente" eyebrow="QR Code geral">
        <MenuQrCode url={menuUrl} storeSlug={storeSlug} />
      </Panel>

      <TablesEditor storeId={storeId} areas={areas} tables={tables} onUpdate={() => {}} />
    </div>
  );
}

'use client';

import { Modal, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TablesEditor, type TableArea, type TableRow } from './TablesEditor';

interface Props {
  storeId: string;
  areas: TableArea[];
  tables: TableRow[];
  open: boolean;
  onClose: () => void;
  onUpdate: (areas: TableArea[], tables: TableRow[]) => void;
}

/** Modal de mesas dentro do PDV — usa o mesmo editor da página /admin/mesas, sempre sincronizados. */
export function TableManager({ storeId, areas, tables, open, onClose, onUpdate }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Salão e mesas"
      subtitle="Configuração do PDV"
      description="Crie ambientes e cadastre mesas sem sair do ponto de venda."
      size="2xl"
      footer={
        <ModalFooter className="gap-3">
          <Button variant="secondary" size="md" onClick={onClose} className="normal-case">
            Fechar
          </Button>
        </ModalFooter>
      }
      bodyClassName="px-5 py-6 sm:px-8 sm:py-7"
    >
      <TablesEditor storeId={storeId} areas={areas} tables={tables} onUpdate={onUpdate} />
    </Modal>
  );
}

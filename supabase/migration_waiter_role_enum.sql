-- PASSO 1/2 — Adiciona o papel waiter ao enum.
-- Rode ESTE arquivo sozinho e confirme sucesso antes do passo 2
-- (migration_waiter_role.sql). No Postgres, o novo valor do enum só pode
-- ser usado depois que a transação que o criou for commitada.

alter type user_role add value if not exists 'waiter';

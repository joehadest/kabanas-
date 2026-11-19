# Kabanas Impressão — instalador Windows

Aplicativo desktop para o caixa do restaurante. Interface visual preta/dourada, assistente de configuração em português e ícone na bandeja do Windows.

## Para você (desenvolvedor) — gerar o instalador

### 1. Instalar Inno Setup 6 (grátis)

Baixe em [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php) — é o programa que gera o `.exe` de instalação padrão (Avançar → Instalar → Concluir).

### 2. Gerar o instalador

```powershell
cd print-agent
npm install
npm run dist
```

Arquivo para o cliente:

```
print-agent/dist/KabanasImpressao-Setup-1.2.0.exe
```

### Alternativa sem Inno Setup (portátil)

Se ainda não tiver o Inno Setup instalado:

```powershell
npm run dist:portable
```

Gera `dist/Kabanas Impressao 1.2.0.exe` — o cliente só dá duplo clique (não instala no Painel de Controle, mas funciona).

### Testar durante o desenvolvimento

```powershell
npm start
```

Para validar a fila sem acionar impressoras físicas, execute `npm test`.

### Publicar uma versão nova (atualização automática)

A partir da 1.2.0 o programa se atualiza sozinho: ele consulta `/api/print-agent/latest` no site, mostra **Atualização disponível** e, com um clique em **Atualizar agora**, baixa o instalador, roda em modo silencioso e reabre já configurado (a configuração fica em `%APPDATA%kabanas-print-agentdata`, fora da pasta instalada).

O instalador fica nos **Releases do GitHub** deste repositório. Para publicar a versão `X.Y.Z`:

1. Suba `"version"` em `print-agent/package.json` (o `npm run dist` passa essa versão ao Inno Setup; mantenha o valor padrão de `build/installer.iss` igual).
2. `npm test` e `npm run dist` dentro de `print-agent/`.
3. Crie um release no GitHub com a tag **`print-agent-vX.Y.Z`** e anexe `dist/KabanasImpressao-Setup-X.Y.Z.exe` (sem marcar como pré-release). Pela linha de comando:

   ```powershell
   gh release create print-agent-vX.Y.Z dist/KabanasImpressao-Setup-X.Y.Z.exe --title "Kabanas Impressão X.Y.Z" --notes "O que mudou"
   ```

Não precisa publicar o site de novo: em até 5 minutos a rota passa a devolver a versão nova e o caixa mostra o aviso na próxima verificação (ao abrir a janela ou a cada 4 horas). O painel em **/admin/impressao** mostra a versão que está rodando no caixa.

Opcional: defina `PRINT_AGENT_GITHUB_TOKEN` (token só de leitura) na hospedagem se a consulta ao GitHub bater no limite de 60 requisições/hora sem token.

**Atenção:** caixas com 1.1.x ou anterior não têm o atualizador. Eles precisam instalar a 1.2.0 à mão uma única vez; depois disso as atualizações são pelo botão.

### Atualização 1.1.2

O agente guarda avisos de novos pedidos recebidos durante uma busca ou impressão e consulta o próximo lote assim que termina o anterior. O intervalo de consulta configurado continua sendo usado quando a fila está vazia ou há uma falha, sem aumentar a frequência de consultas enquanto o caixa está ocioso.

Versões até a 1.1.2 precisam ser instaladas à mão no caixa; publicar apenas o site não atualiza o programa já instalado no Windows.

## Para o cliente — instalar no caixa

1. Baixe `KabanasImpressao-Setup-1.2.0.exe` (link em **Impressão** no painel web)
2. Duplo clique → **Avançar** → **Instalar** → **Concluir**
3. Na primeira abertura, siga o assistente em 3 passos:
   - Boas-vindas
   - Cole **Store ID** e **token** de [kabanasbeer.webpulseservicos.com/admin/impressao](https://kabanasbeer.webpulseservicos.com/admin/impressao)
   - Escolha impressora da **cozinha** e do **caixa**
4. Pronto — o app fica na **bandeja do Windows** (perto do relógio)

### Uso diário

- Fechar a janela **não encerra** o programa
- Duplo clique no ícone da bandeja para abrir
- Botões **Testar cozinha** / **Testar caixa** na tela principal
- Marque **Abrir com o Windows** para iniciar automaticamente
- Quando aparecer **Atualização disponível**, clique em **Atualizar agora**: o programa fecha, instala e abre sozinho em cerca de 1 minuto

### Desinstalar

Configurações do Windows → Aplicativos → **Kabanas Impressão** → Desinstalar

## O que o app faz

- Roda em segundo plano no PC do caixa
- Busca pedidos na fila do painel Kabanas
- Imprime ficha de **cozinha** e **conta do cliente**
- Responde ao painel web em `http://127.0.0.1:9100/health` (inclui a versão instalada)

## Requisitos no servidor

- `SUPABASE_SERVICE_ROLE_KEY` na hospedagem
- Migrações SQL de impressão executadas no Supabase

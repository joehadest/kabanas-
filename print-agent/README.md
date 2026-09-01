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
print-agent/dist/KabanasImpressao-Setup-1.0.0.exe
```

### Alternativa sem Inno Setup (portátil)

Se ainda não tiver o Inno Setup instalado:

```powershell
npm run dist:portable
```

Gera `dist/Kabanas Impressao 1.0.0.exe` — o cliente só dá duplo clique (não instala no Painel de Controle, mas funciona).

### Testar durante o desenvolvimento

```powershell
npm start
```

## Para o cliente — instalar no caixa

1. Baixe `KabanasImpressao-Setup-1.0.0.exe`
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

### Desinstalar

Configurações do Windows → Aplicativos → **Kabanas Impressão** → Desinstalar

## O que o app faz

- Roda em segundo plano no PC do caixa
- Busca pedidos na fila do painel Kabanas
- Imprime ficha de **cozinha** e **conta do cliente**
- Responde ao painel web em `http://127.0.0.1:9100/health`

## Requisitos no servidor

- `SUPABASE_SERVICE_ROLE_KEY` na hospedagem
- Migrações SQL de impressão executadas no Supabase

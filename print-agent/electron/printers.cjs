const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const execFileAsync = promisify(execFile);

async function listWindowsPrinters() {
  const ps = "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  return parsed ? [parsed] : [];
}

/**
 * Script PowerShell que envia bytes direto ao spooler com datatype RAW
 * (winspool.drv). É o que faz a impressora interpretar ESC/POS em vez de
 * imprimir os códigos como texto (Out-Printer passa pelo driver GDI).
 */
const RAW_PRINT_PS1 = String.raw`
param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;

namespace Kabanas
{
    public static class RawPrinter
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public class DOCINFO
        {
            [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
        }

        [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool OpenPrinter(string printerName, out IntPtr hPrinter, IntPtr pDefault);

        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO docInfo);

        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool WritePrinter(IntPtr hPrinter, byte[] bytes, int count, out int written);

        public static void Send(string printerName, string filePath)
        {
            byte[] bytes = File.ReadAllBytes(filePath);
            IntPtr handle;
            if (!OpenPrinter(printerName, out handle, IntPtr.Zero))
                throw new Exception("OpenPrinter falhou (win32=" + Marshal.GetLastWin32Error() + "). Confira o nome da impressora.");
            try
            {
                DOCINFO doc = new DOCINFO();
                doc.pDocName = "Kabanas ESC/POS";
                doc.pDataType = "RAW";
                if (!StartDocPrinter(handle, 1, doc))
                    throw new Exception("StartDocPrinter falhou (win32=" + Marshal.GetLastWin32Error() + ").");
                try
                {
                    if (!StartPagePrinter(handle))
                        throw new Exception("StartPagePrinter falhou (win32=" + Marshal.GetLastWin32Error() + ").");
                    int written;
                    if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length)
                        throw new Exception("WritePrinter falhou (win32=" + Marshal.GetLastWin32Error() + ").");
                    EndPagePrinter(handle);
                }
                finally { EndDocPrinter(handle); }
            }
            finally { ClosePrinter(handle); }
        }
    }
}
'@

[Kabanas.RawPrinter]::Send($PrinterName, $FilePath)
`;

/**
 * Envia bytes ESC/POS (Buffer) direto para a impressora (datatype RAW).
 */
async function printRaw(printerName, data) {
  if (!printerName) {
    throw new Error('Nenhuma impressora selecionada.');
  }
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'latin1');
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const binPath = path.join(os.tmpdir(), `kabanas-${stamp}.bin`);
  const ps1Path = path.join(os.tmpdir(), `kabanas-${stamp}.ps1`);
  fs.writeFileSync(binPath, buffer);
  fs.writeFileSync(ps1Path, RAW_PRINT_PS1, 'utf8');
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path, '-PrinterName', printerName, '-FilePath', binPath],
      { windowsHide: true, timeout: 60_000 }
    );
  } catch (error) {
    const raw = String(error.stderr || error.message || error);
    const detail =
      raw.match(/(OpenPrinter|StartDocPrinter|StartPagePrinter|WritePrinter)[^\r\n"]*/)?.[0] ||
      raw.replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`Falha ao imprimir em "${printerName}": ${detail}`);
  } finally {
    fs.unlink(binPath, () => {});
    fs.unlink(ps1Path, () => {});
  }
}

module.exports = { listWindowsPrinters, printRaw };

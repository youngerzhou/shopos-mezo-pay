import { PackageSearch, QrCode, ScanLine, User, UserCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TopHeaderProps {
  scanInput: string;
  loading: boolean;
  isScanning: boolean;
  staffName: string;
  memberLabel: string;
  walletLabel: string;
  onScanInputChange: (value: string) => void;
  onSubmitScan: () => void;
  onOpenCamera: () => void;
  onShowStaffQR: () => void;
  onReset: () => void;
}

export function TopHeader({
  scanInput,
  loading,
  isScanning,
  staffName,
  memberLabel,
  walletLabel,
  onScanInputChange,
  onSubmitScan,
  onOpenCamera,
  onShowStaffQR,
  onReset
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-orange-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">SHOPOS Mezo</p>
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">Supermarket POS</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-2 rounded-lg text-slate-700 hover:bg-red-950 hover:text-white"
              onClick={onShowStaffQR}
              title="Show staff QR code"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                <User className="h-4 w-4 text-orange-700" />
              </span>
              <span className="hidden text-xs font-black sm:inline">{staffName}</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-700" />
              <Input
                value={scanInput}
                onChange={(event) => onScanInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSubmitScan();
                }}
                placeholder="Barcode, member QR, or wallet address"
                className="h-12 rounded-lg border-orange-200 pl-9 font-bold focus-visible:ring-orange-600"
              />
            </div>
            <Button className="h-12 rounded-lg bg-orange-600 px-4 hover:bg-red-950" disabled={loading} onClick={onSubmitScan}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
            </Button>
            <Button variant="outline" className="h-12 rounded-lg border-orange-200 font-black hover:bg-red-950 hover:text-white" onClick={onOpenCamera}>
              <QrCode className="mr-2 h-4 w-4" />
              Camera
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold sm:text-xs lg:w-[420px]">
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-orange-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
              <UserCheck className="h-3.5 w-3.5 shrink-0 text-orange-700 sm:h-4 sm:w-4" />
              <span className="min-w-0 truncate">{memberLabel}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-orange-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-orange-700 sm:h-4 sm:w-4" />
              <span className="min-w-0 truncate">{walletLabel}</span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-950 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white">
            {isScanning ? 'Camera Active' : 'Ready'}
          </div>
        </div>
      </div>
    </header>
  );
}

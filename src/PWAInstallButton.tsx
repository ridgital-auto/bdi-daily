import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuide(true);
          }
        }}
        className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install Aplikasi HP</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 border border-slate-200 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Pasang di Vivo Y71 / Android
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800"
                aria-label="Tutup panduan instalasi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700 leading-relaxed">
              {isIOS ? (
                <>
                  <p>Untuk memasang aplikasi di perangkat iOS/Safari:</p>
                  <ol className="list-decimal list-inside space-y-1.5 font-medium">
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah browser.</li>
                    <li>Pilih menu <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p>
                    Aplikasi ini telah dioptimalkan dalam <strong>Mode Ringan (PWA)</strong> agar hemat RAM dan baterai di Vivo Y71 maupun Android lainnya:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 font-medium">
                    <li>Ketuk ikon <strong>Titik Tiga (⋮)</strong> di pojok kanan atas Google Chrome.</li>
                    <li>Pilih <strong>Instal aplikasi (Install app)</strong> atau <strong>Tambahkan ke layar utama</strong>.</li>
                    <li>Buka aplikasi langsung dari ikon <strong>BDI Hadis</strong> di layar utama HP Anda.</li>
                  </ol>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 rounded-lg bg-amber-700 px-4 py-2.5 text-xs font-semibold text-white shadow-md flex items-center justify-between">
      <span>Mode Offline Aktif · Menampilkan data tersimpan di perangkat</span>
    </div>
  );
};

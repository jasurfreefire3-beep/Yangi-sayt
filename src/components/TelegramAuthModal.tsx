import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft, Send, Loader2, CheckCircle2, ShieldCheck, Sparkles, User, ExternalLink } from 'lucide-react';

interface TelegramAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
  botUsername?: string;
}

export default function TelegramAuthModal({
  isOpen,
  onClose,
  onSuccess,
  botUsername = 'Animem_register_bot'
}: TelegramAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'select' | 'widget' | 'bot'>('select');
  
  // Bot auth states
  const [sessionId, setSessionId] = useState('');
  const [botStatus, setBotStatus] = useState<'pending' | 'pending_phone' | 'authorized' | 'expired' | ''>('');
  const [botProgress, setBotProgress] = useState(1);
  
  // Widget auth states
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetScriptLoaded, setWidgetScriptLoaded] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  
  // Success & Error states
  const [error, setError] = useState('');
  const [successUser, setSuccessUser] = useState<any>(null);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setAuthMethod('select');
      setError('');
      setSessionId('');
      setBotStatus('');
      setBotProgress(1);
      setSuccessUser(null);
      setWidgetLoading(false);
      setWidgetScriptLoaded(false);
    }
  }, [isOpen]);

  // Global Telegram Widget callback handler
  useEffect(() => {
    (window as any).onTelegramWidgetAuth = async (user: any) => {
      try {
        setWidgetLoading(true);
        setError('');
        
        const res = await fetch('/api/auth/telegram/widget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
        
        const data = await res.json();
        if (!res.ok || !data.token || !data.user) {
          throw new Error(data.error || "Telegram widget orqali kirishda xatolik yuz berdi");
        }

        setSuccessUser(data.user);
        setTimeout(() => {
          onSuccess(data.token, data.user);
          onClose();
        }, 1800);
      } catch (err: any) {
        console.error("Telegram widget login error:", err);
        setError(err.message || "Telegram orqali kirishda xatolik yuz berdi");
      } finally {
        setWidgetLoading(false);
      }
    };

    return () => {
      delete (window as any).onTelegramWidgetAuth;
    };
  }, [onSuccess, onClose]);

  // Inject Telegram Widget Script when widget mode is selected
  useEffect(() => {
    if (isOpen && authMethod === 'widget' && widgetContainerRef.current) {
      widgetContainerRef.current.innerHTML = '';
      setWidgetScriptLoaded(false);

      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'true');
      script.setAttribute('data-onauth', 'onTelegramWidgetAuth(user)');
      
      script.onload = () => {
        setWidgetScriptLoaded(true);
      };

      widgetContainerRef.current.appendChild(script);
    }
  }, [isOpen, authMethod, botUsername]);

  // Start Bot Session
  const startBotAuth = async () => {
    try {
      setError('');
      setAuthMethod('bot');
      setBotProgress(1);
      setBotStatus('pending');

      const res = await fetch('/api/auth/telegram/session');
      const data = await res.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
      } else {
        throw new Error('Telegram seansini yaratib bo\'lmadi');
      }
    } catch (err: any) {
      setError(err.message || 'Telegram bot seansini boshlashda xatolik');
    }
  };

  // Poll Bot Session Status
  useEffect(() => {
    if (!sessionId || authMethod !== 'bot' || !isOpen || botStatus === 'authorized') return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/telegram/status/${sessionId}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.status) {
          setBotStatus(data.status);
          if (data.status === 'pending_phone') {
            setBotProgress(2);
          } else if (data.status === 'authorized') {
            setBotProgress(3);
            setSuccessUser(data.user);
            clearInterval(interval);

            setTimeout(() => {
              onSuccess(data.token, data.user);
              onClose();
            }, 1800);
          } else if (data.status === 'expired') {
            setError('Telegram avtorizatsiya vaqti tugadi. Iltimos qaytadan urining.');
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error polling Telegram session:', err);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, authMethod, isOpen, botStatus, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-[#0e0e12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative"
      >
        {/* Top bar with back & close buttons */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          {authMethod !== 'select' && !successUser ? (
            <button
              onClick={() => {
                setAuthMethod('select');
                setError('');
              }}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Usulni o'zgartirish
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0088cc] animate-pulse"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Telegram Auth</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 bg-white/5 hover:bg-white/10 rounded-full cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7">
          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
              <span className="font-bold text-sm leading-none mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success State */}
          {successUser ? (
            <div className="text-center py-6 flex flex-col items-center justify-center">
              <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-emerald-500/20 rounded-full"
                />
                {successUser.avatar_url ? (
                  <img
                    src={successUser.avatar_url}
                    alt={successUser.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-lg shadow-emerald-500/30"
                  />
                ) : (
                  <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 border border-emerald-400">
                    <CheckCircle2 size={32} className="text-white" />
                  </div>
                )}
              </div>

              <h2 className="text-xl font-black text-white uppercase tracking-wider mb-1">
                Muvaffaqiyatli!
              </h2>
              <p className="text-sm font-bold text-emerald-400 mb-1">
                {successUser.name || 'Telegram Foydalanuvchisi'}
              </p>
              <p className="text-xs text-white/50">
                Siz saytga muvaffaqiyatli kirdingiz. Bosh sahifaga yo'naltirilmoqda...
              </p>
            </div>
          ) : (
            <>
              {/* STEP 1: METHOD SELECTION */}
              {authMethod === 'select' && (
                <div>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-[#0088cc]/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#0088cc]/20 shadow-[0_0_20px_rgba(0,136,204,0.2)]">
                      <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#0088cc] fill-current">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-.97.53-1.34.52-.41-.01-1.21-.23-1.8-.42-.73-.24-1.32-.37-1.27-.78.02-.21.31-.43.87-.67 3.42-1.49 5.71-2.48 6.86-2.96 3.27-1.37 3.95-1.61 4.4-.1.01.03.02.05.02.08.01.12.01.25-.01.37z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-black text-white tracking-wide">Telegram orqali kirish</h2>
                    <p className="text-white/50 text-xs mt-1">O'zingizga ma'qul bo'lgan kirish usulini tanlang</p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Option 1: Official Telegram Widget (Tavsiya) */}
                    <button
                      onClick={() => setAuthMethod('widget')}
                      className="w-full text-left p-4 rounded-xl border border-[#0088cc]/40 bg-gradient-to-br from-[#0088cc]/10 via-[#0088cc]/5 to-transparent hover:border-[#0088cc] hover:from-[#0088cc]/20 transition-all duration-300 relative group cursor-pointer shadow-[0_0_20px_rgba(0,136,204,0.15)]"
                    >
                      {/* TAVSIYA BADGE */}
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
                          <Sparkles size={11} className="text-emerald-400" />
                          Tavsiya
                        </span>
                      </div>

                      <div className="flex items-start gap-3.5 pr-20">
                        <div className="w-10 h-10 rounded-xl bg-[#0088cc] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#0088cc]/30 group-hover:scale-105 transition-transform">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white group-hover:text-[#0088cc] transition-colors flex items-center gap-1.5">
                            Telegram Rasmiy Kirish (Widget)
                          </div>
                          <p className="text-[11px] text-white/60 mt-1 leading-relaxed">
                            1 bosishda to'g'ridan-to'g'ri kirish. Telegramdagi ism va profilingiz rasmi avtomatik ulanadi.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Option 2: Telegram Bot (@Animem_register_bot) */}
                    <button
                      onClick={startBotAuth}
                      className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 relative group cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white/10 text-[#0088cc] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Send size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white group-hover:text-white transition-colors">
                            Telegram Bot orqali kirish
                          </div>
                          <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                            @{botUsername} boti orqali 2 bosqichli tasdiqlash va telefon raqam bilan kirish.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2A: OFFICIAL TELEGRAM WIDGET */}
              {authMethod === 'widget' && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-3">
                    <Sparkles size={12} /> Rasmiy Telegram Avtorizatsiyasi
                  </div>
                  
                  <h3 className="text-base font-black text-white">Telegram orqali tasdiqlang</h3>
                  <p className="text-xs text-white/50 mt-1 mb-6 max-w-xs mx-auto">
                    Quyidagi rasmiy Telegram tugmasini bosing va kirishni tasdiqlang:
                  </p>

                  <div className="min-h-[90px] flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-xl relative">
                    {widgetLoading && (
                      <div className="flex items-center gap-2 text-xs text-[#0088cc] font-bold mb-3">
                        <Loader2 size={16} className="animate-spin" />
                        Telegram orqali kirilmoqda...
                      </div>
                    )}
                    
                    {/* Official Telegram Widget Container */}
                    <div ref={widgetContainerRef} className="flex justify-center items-center py-2" />

                    {!widgetScriptLoaded && !widgetLoading && (
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Loader2 size={14} className="animate-spin text-[#0088cc]" />
                        Telegram Widget yuklanmoqda...
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const botId = '8738762833';
                        const origin = encodeURIComponent(window.location.origin);
                        const screenW = window.screen.availWidth || window.innerWidth || 1024;
                        const screenH = window.screen.availHeight || window.innerHeight || 768;
                        const directUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${origin}&embed=0&request_access=write`;
                        const win = window.open(directUrl, '_blank', `width=${screenW},height=${screenH},top=0,left=0,toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=yes`);
                        if (!win) window.location.href = directUrl;
                      }}
                      className="inline-flex items-center gap-2 text-xs text-[#0088cc] hover:text-white bg-[#0088cc]/10 hover:bg-[#0088cc]/30 border border-[#0088cc]/30 hover:border-[#0088cc] px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer font-bold"
                    >
                      <ExternalLink size={13} />
                      Brauzerni to'liq ekranda ochish
                    </button>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/20 text-[11px] text-white/70 text-left flex items-start gap-2.5">
                    <ShieldCheck size={16} className="text-[#0088cc] shrink-0 mt-0.5" />
                    <span>
                      Telegram profilingizdagi <strong>Ism</strong> va <strong>Profil rasmi (avatar)</strong> saytingiz hisobiga avtomatik biriktiriladi.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 2B: TELEGRAM BOT FLOW */}
              {authMethod === 'bot' && (
                <div>
                  <div className="text-center mb-6">
                    <h3 className="text-base font-black text-white">Telegram Bot orqali kirish</h3>
                    <p className="text-xs text-white/50 mt-1">@{botUsername}</p>
                  </div>

                  {/* Progress Indicators */}
                  <div className="flex justify-center items-center gap-2 mb-6">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      botProgress === 1 
                        ? 'bg-[#0088cc]/15 border-[#0088cc]/40 text-[#0088cc]' 
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}>
                      <span className="w-4 h-4 rounded-full bg-[#0088cc] text-white flex items-center justify-center text-[9px] font-black">1</span>
                      Botga o'tish
                    </div>
                    <div className="w-4 h-[1px] bg-white/10"></div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      botProgress === 2 
                        ? 'bg-[#0088cc]/15 border-[#0088cc]/40 text-[#0088cc]' 
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}>
                      <span className="w-4 h-4 rounded-full bg-[#0088cc] text-white flex items-center justify-center text-[9px] font-black">2</span>
                      Kontaktni yuborish
                    </div>
                  </div>

                  {botProgress === 1 ? (
                    <div className="space-y-4 text-center">
                      <p className="text-xs text-white/70 leading-relaxed max-w-xs mx-auto">
                        Quyidagi tugmani bosib botni oching va pastdagi <strong className="text-[#0088cc]">"START"</strong> tugmasini bosing:
                      </p>
                      <div className="py-2">
                        <a
                          href={`https://t.me/${botUsername}?start=${sessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#0088cc] to-[#00a2ed] hover:from-[#0077b5] hover:to-[#0088cc] text-white font-bold rounded-xl shadow-lg shadow-[#0088cc]/25 transition-all duration-300 hover:scale-[1.02] text-xs uppercase tracking-wider cursor-pointer"
                        >
                          <Send size={14} />
                          Telegram Botni ochish
                          <ExternalLink size={12} className="opacity-70" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center py-4">
                      <p className="text-xs text-white/70 leading-relaxed max-w-xs mx-auto">
                        Botda paydo bo'lgan <strong className="text-emerald-400">"📱 Telefon raqamni yuborish"</strong> tugmasini bosing.
                      </p>
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl text-xs font-bold">
                        <Loader2 size={14} className="animate-spin" />
                        Raqam yuborilishi kutilmoqda...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

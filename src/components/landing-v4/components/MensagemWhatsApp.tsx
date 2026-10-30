// Cartão "enviado pelo WhatsApp": texto baseado na mensagem padrão de acompanhamento do MecApp
// (DialogConfiguracaoMensagensWhatsApp: "Olá {{cliente_nome}}! Acompanhe sua OS #{{numero_os}} em tempo real: {{link}}").

export function LogoWhatsApp({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="WhatsApp">
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
      />
    </svg>
  );
}

export function MensagemWhatsApp({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ${compacta ? "w-48 p-2.5" : "w-64 p-3.5"}`}>
      <div className="flex items-center gap-2">
        <LogoWhatsApp className={compacta ? "h-5 w-5" : "h-6 w-6"} />
        <p className={`font-display font-semibold text-slate-950 ${compacta ? "text-xs" : "text-sm"}`}>Enviado pelo WhatsApp</p>
      </div>
      <div className={`mt-2 rounded-xl rounded-tl-sm bg-[#E7FCE3] text-slate-800 ${compacta ? "p-2 text-xs leading-snug" : "p-3 text-[13px] leading-snug"}`}>
        Olá! Acompanhe sua OS em tempo real:
        <span className="mt-1 block font-medium text-brand-700 underline decoration-brand-300 underline-offset-2">
          link de acompanhamento
        </span>
        <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-600">
          agora
          <svg viewBox="0 0 18 12" className="h-2.5 w-3.5" aria-hidden="true">
            <path d="m1 6.5 3 3 6-7M7 9.5l1 0 6-7" fill="none" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}

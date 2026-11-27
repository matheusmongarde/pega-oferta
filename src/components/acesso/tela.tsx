import type { ReactNode } from "react";
import { AvatarLogo } from "@/components/ui/avatar-logo";

function IconeEspelho() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="#dcfce7" />
      <circle cx="13" cy="13" r="5" fill="#16a34a" />
      <circle cx="13" cy="13" r="2.6" fill="#86efac" />
      <circle cx="31" cy="13" r="5" fill="#16a34a" />
      <circle cx="31" cy="13" r="2.6" fill="#86efac" />
      <ellipse cx="22" cy="24" rx="12" ry="10.5" fill="#22c55e" />
      <rect x="11.5" y="19" width="9.2" height="5.6" rx="2.4" fill="#141311" />
      <rect x="23.3" y="19" width="9.2" height="5.6" rx="2.4" fill="#141311" />
      <path d="M20.7 21.3h2.6" stroke="#141311" strokeWidth="2" />
      <path d="M13.6 20.8l2.2 2M25.4 20.8l2.2 2" stroke="#86efac" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="22" cy="26.8" r="1.7" fill="#14532d" />
      <path d="M18.8 29.6c1.8 1.5 4.8 1.4 6.5-.2" stroke="#14532d" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M11 26.8l3.5.4M11.4 29.4l3.3-.6M33 26.8l-3.5.4M32.6 29.4l-3.3-.6" stroke="#14532d" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconeTrocador() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="#fef3c7" />
      <circle cx="22" cy="23" r="11.5" fill="#1f1d1a" />
      <rect x="11.5" y="18.2" width="21" height="7" rx="3.5" fill="#fde68a" />
      <path d="M32.5 18.5l5-2.5M32.8 21l4.8 1.6" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="18.4" cy="21.7" r="2.2" fill="#141311" />
      <circle cx="26.4" cy="21.7" r="2.2" fill="#141311" />
      <circle cx="19.1" cy="21.1" r="0.8" fill="#ffffff" />
      <circle cx="27.1" cy="21.1" r="0.8" fill="#ffffff" />
      <path d="M15.4 18.4l5.2 1.1M28.8 18.4l-5.2 1.1" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="15" y="29" width="14" height="6.2" rx="3.1" fill="#f59e0b" />
      <circle cx="18.2" cy="32.1" r="1.1" fill="#fffbeb" />
      <path d="M21 32.1h5.4" stroke="#fffbeb" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 11.5v4M7.5 13.5h4" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeCupons() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="#e0e7ff" />
      <g transform="rotate(-8 22 22)">
        <rect x="8" y="13" width="28" height="18" rx="4" fill="#4f46e5" />
        <circle cx="8" cy="22" r="3.2" fill="#e0e7ff" />
        <circle cx="36" cy="22" r="3.2" fill="#e0e7ff" />
        <circle cx="16.5" cy="20" r="2.6" fill="#ffffff" />
        <circle cx="27.5" cy="20" r="2.6" fill="#ffffff" />
        <circle cx="17.2" cy="20" r="1.2" fill="#1e1b4b" />
        <circle cx="28.2" cy="20" r="1.2" fill="#1e1b4b" />
        <path d="M18.5 25.2c2 2.2 5 2.2 7 0" stroke="#fde047" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <circle cx="33.5" cy="11.5" r="5" fill="#facc15" />
      <text x="33.5" y="14.3" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#1e1b4b">%</text>
    </svg>
  );
}

function IconeEsteira() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="#f3e8ff" />
      <path d="M12 20c0-6 4.5-10 10-10s10 4 10 10H12z" fill="#facc15" />
      <rect x="10" y="18.5" width="24" height="3.2" rx="1.6" fill="#eab308" />
      <rect x="20.4" y="10" width="3.2" height="8.5" rx="1.2" fill="#fef08a" />
      <rect x="13" y="21.5" width="18" height="12.5" rx="4.5" fill="#7c3aed" />
      <rect x="15.5" y="24" width="13" height="6.2" rx="3" fill="#1e1b4b" />
      <path d="M18 27.6c.7-1.1 1.7-1.1 2.4 0M23.6 27.6c.7-1.1 1.7-1.1 2.4 0" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M33.5 26l4 1.6v3.2c0 2.5-1.7 4.4-4 5.2-2.3-.8-4-2.7-4-5.2v-3.2l4-1.6z" fill="#22c55e" stroke="#f3e8ff" strokeWidth="1.2" />
      <path d="M31.9 31l1.2 1.2 2.2-2.3" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconeMonitor() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="#fee2e2" />
      <path d="M12 15l4.5 3.5h11L32 15l-1 15.5c0 3.2-4 5.5-9 5.5s-9-2.3-9-5.5L12 15z" fill="#dc2626" />
      <circle cx="17.5" cy="22.5" r="4.6" fill="#ffffff" />
      <circle cx="26.5" cy="22.5" r="4.6" fill="#ffffff" />
      <circle cx="18.2" cy="22.8" r="2.1" fill="#141311" />
      <circle cx="25.8" cy="22.8" r="2.1" fill="#141311" />
      <circle cx="19" cy="21.8" r="0.8" fill="#ffffff" />
      <circle cx="26.6" cy="21.8" r="0.8" fill="#ffffff" />
      <path d="M22 25.2l-2 3h4l-2-3z" fill="#facc15" />
      <path d="M8 10l4 4 2.5-2 3.5 3.5" stroke="#991b1b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15.8 15.5H18v-2.2" stroke="#991b1b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconeVip() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="#e0f2fe" />
      <path d="M15.5 14l2-5 4.5 3.2L26.5 9l2 5h-13z" fill="#f59e0b" />
      <path d="M22 14.5c-5.5 0-9.2 4-9.2 9.5v4.5l-2 2.5h22.4l-2-2.5V24c0-5.5-3.7-9.5-9.2-9.5z" fill="#0284c7" />
      <circle cx="22" cy="33.2" r="2.6" fill="#f59e0b" />
      <circle cx="18.6" cy="23.5" r="1.5" fill="#ffffff" />
      <circle cx="25.4" cy="23.5" r="1.5" fill="#ffffff" />
      <circle cx="16.2" cy="25.8" r="1.3" fill="#fda4af" opacity="0.8" />
      <circle cx="27.8" cy="25.8" r="1.3" fill="#fda4af" opacity="0.8" />
      <path d="M19.2 26.8c1.5 1.6 4.1 1.6 5.6 0" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M8.5 19.5c-1 1.6-1 3.4 0 5M35.5 19.5c1 1.6 1 3.4 0 5" stroke="#0369a1" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const MOTORES = [
  {
    icone: IconeEspelho,
    nome: "Espelho WhatsApp",
    faz: "copia ofertas de grandes grupos ao vivo",
  },
  {
    icone: IconeTrocador,
    nome: "Trocador de Links",
    faz: "arranca o link do concorrente e põe sua tag",
  },
  {
    icone: IconeCupons,
    nome: "Radar de Cupons",
    faz: "captura códigos e gera arte com logo oficial",
  },
  {
    icone: IconeEsteira,
    nome: "Esteira Anti-Ban",
    faz: "fila Kanban com travas e multi-WhatsApp",
  },
  {
    icone: IconeMonitor,
    nome: "Monitor de Preço",
    faz: "vigia produtos 24h e dispara quando cair",
  },
  {
    icone: IconeVip,
    nome: "Pedidos VIP",
    faz: "avisa no privado quem pediu um produto",
  },
];

export function TelaAcesso({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ac">
      <aside className="ac-equipe" aria-label="O que o Pega Oferta faz">
        <div>
          <p className="ac-sobrelinha">Projeto aberto · grátis para sempre</p>
          <p className="ac-manchete font-display">
            Seus grupos de ofertas, tocados no piloto automático.
          </p>
        </div>

        <ul className="ac-equipe-lista">
          {MOTORES.map((m) => {
            const Icone = m.icone;
            return (
              <li key={m.nome} className="ac-membro">
                <Icone />
                <span>
                  <strong>{m.nome}</strong>
                  <span>{m.faz}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="ac-rodape-equipe">
          Roda 100% no seu computador, com seus dados e suas tags de afiliado.
        </p>
      </aside>

      <main className="ac-lado">
        <div className="flex items-center gap-2.5">
          <AvatarLogo size={34} />
          <div className="leading-none">
            <span className="ac-marca font-display text-base font-extrabold tracking-tight">
              pega-oferta
            </span>
            <span className="ac-marca-sub mt-0.5 block text-[11px] font-medium">
              ofertas no automático
            </span>
          </div>
        </div>

        <div className="ac-miolo">
          <h1 className="ac-titulo font-display">{titulo}</h1>
          {sub ? <p className="ac-sub">{sub}</p> : null}
          <div className="ac-corpo">{children}</div>
        </div>

        <p className="ac-pedagio">
          Grátis e aberto. O pedágio é seguir{" "}
          <a href="https://x.com/mongarde_" target="_blank" rel="noreferrer">
            @mongarde_
          </a>{" "}
          e{" "}
          <a href="https://x.com/joaoedicao" target="_blank" rel="noreferrer">
            @joaoedicao
          </a>{" "}
          no X.
        </p>
      </main>
    </div>
  );
}
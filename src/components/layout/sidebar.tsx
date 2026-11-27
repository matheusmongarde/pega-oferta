"use client";

import type React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AvatarLogo } from "@/components/ui/avatar-logo";
import {
  LayoutDashboard,
  Tag,
  Radio,
  Layers,
  Plug,
  Activity,
  Store,
  HeartHandshake,
  Sun,
  Moon,
  ChevronLeft,
  Menu as MenuIcon,
  Users,
  GitBranch,
  Ticket,
  Crosshair,
  MessageCircle,
  Send,
  UserCog,
  X,
} from "lucide-react";

export interface StatusSaude {
  telegram: boolean;
  whatsapp: boolean;
  fontes: boolean;
  vitrine: boolean;
}

interface SidebarProps {
  ofertasPendentes: number;
  status: StatusSaude;
  modoTeste: boolean;
  temTagReal?: boolean;
  waNumero?: string | null;
  nomeOperacao?: string;
  desejosMatch?: number;
  monitoresAtingidos?: number;
  arrobaMarca?: string;
  logoUrl?: string;
}

type TemaEscolha = "claro" | "escuro";

function formatarNumeroWa(num?: string | null): string {
  if (!num) return "";
  const d = num.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    return `+55 (${ddd}) ${resto.slice(0, -4)}-${resto.slice(-4)}`;
  }
  return `+${d}`;
}

function useRecolhido() {
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("pega-oferta:menu");
      const isRecolhido = salvo === "recolhido";
      document.documentElement.dataset.menu = isRecolhido ? "recolhido" : "aberto";
      setRecolhido(isRecolhido);
    } catch {
      /* sem storage */
    }
  }, []);

  const alternar = useCallback(() => {
    setRecolhido((atual) => {
      const proximo = !atual;
      document.documentElement.dataset.menu = proximo ? "recolhido" : "aberto";
      try {
        localStorage.setItem("pega-oferta:menu", proximo ? "recolhido" : "aberto");
      } catch {
        /* sem storage */
      }
      return proximo;
    });
  }, []);

  return [recolhido, alternar] as const;
}

function BotaoTemaLua() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("pega-oferta:tema");
      const prefEscuro =
        salvo === "escuro" ||
        (salvo !== "claro" &&
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      setEscuro(prefEscuro);
      if (salvo === "claro" || salvo === "escuro") {
        document.documentElement.setAttribute("data-tema", salvo);
      }
    } catch {
      /* sem storage */
    }
  }, []);

  function alternar() {
    const proximo: TemaEscolha = escuro ? "claro" : "escuro";
    const root = document.documentElement;
    root.classList.add("trocando-tema");
    root.setAttribute("data-tema", proximo);
    void root.offsetHeight;
    setEscuro(!escuro);
    try {
      localStorage.setItem("pega-oferta:tema", proximo);
    } catch {
      /* sem storage */
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        root.classList.remove("trocando-tema");
      });
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-tinta-2 transition hover:bg-rebaixo hover:text-tinta"
    >
      {escuro ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

/** Cancela do pedagio pulando (igual ao garimpo). Some quando os 4 itens forem pagos. */
function Cancela() {
  return (
    <span
      className="pulso-pedagio relative grid h-6 w-7 shrink-0 place-items-center rounded-full bg-[#e3ad35]/15"
      title="Pedágio pendente"
      aria-label="Pedágio pendente"
    >
      <svg viewBox="0 0 24 20" className="cancela-pula h-[15px] w-[18px] overflow-visible" aria-hidden>
        <rect x="3" y="7" width="4" height="12" rx="1.5" fill="#3d4450" />
        <rect x="1.5" y="17.5" width="7" height="2.5" rx="1" fill="#3d4450" />
        <g className="cancela-braco">
          <rect x="4" y="8" width="19" height="4" rx="2" fill="#fff" stroke="#c0262d" strokeWidth="0.8" />
          <path d="M8 8h3l-2 4H6zM14 8h3l-2 4h-3zM20 8h2.5v1.5L21 12h-3z" fill="#c0262d" />
        </g>
        <circle cx="5" cy="10" r="1.6" fill="#e3ad35" />
      </svg>
    </span>
  );
}

/** Ainda falta pagar o pedagio? (guardado no navegador pela pagina Pedagio) */
function usePedagioPendente(total = 4) {
  const [pendente, setPendente] = useState(false);
  useEffect(() => {
    const ler = () => {
      try {
        const pagos = JSON.parse(localStorage.getItem("pega-oferta:pedagio") || "[]") as string[];
        setPendente(!Array.isArray(pagos) || pagos.length < total);
      } catch {
        setPendente(true);
      }
    };
    ler();
    window.addEventListener("storage", ler);
    window.addEventListener("pega-oferta:pedagio", ler);
    return () => {
      window.removeEventListener("storage", ler);
      window.removeEventListener("pega-oferta:pedagio", ler);
    };
  }, [total]);
  return pendente;
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  corBg: string;
  corFg: string;
  conta?: number;
  pendencia?: boolean;
  externo?: boolean;
}

export function Sidebar({
  ofertasPendentes,
  status,
  modoTeste,
  temTagReal = true,
  waNumero = null,
  nomeOperacao = "Pega Oferta",
  desejosMatch = 0,
  monitoresAtingidos = 0,
  arrobaMarca = "@pegaoferta",
  logoUrl = "",
}: SidebarProps) {
  const pathname = usePathname();
  const [abertoMobile, setAbertoMobile] = useState(false);
  const [recolhido, alternar] = useRecolhido();
  const pedagioPendente = usePedagioPendente();

  useEffect(() => {
    setAbertoMobile(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        alternar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alternar]);

  const grupos: Array<{ nome: string; itens: MenuItem[] }> = [
    {
      nome: "Operação",
      itens: [
        {
          href: "/",
          label: "Visão geral",
          icon: LayoutDashboard,
          corBg: "var(--sec-inicio-bg)",
          corFg: "var(--sec-inicio-fg)",
        },
        {
          href: "/fontes",
          label: "Fontes & Espelho",
          icon: Radio,
          corBg: "var(--sec-fontes-bg)",
          corFg: "var(--sec-fontes-fg)",
        },
        {
          href: "/ofertas",
          label: "Ofertas",
          icon: Tag,
          corBg: "var(--sec-ofertas-bg)",
          corFg: "var(--sec-ofertas-fg)",
          conta: ofertasPendentes,
          pendencia: true,
        },
        {
          href: "/fila",
          label: "Esteira & Fila",
          icon: Activity,
          corBg: "var(--sec-esteira-bg)",
          corFg: "var(--sec-esteira-fg)",
        },
      ],
    },
    {
      nome: "Grupos & Radar",
      itens: [
        {
          href: "/cascata",
          label: "Meus Grupos",
          icon: GitBranch,
          corBg: "var(--sec-grupos-bg)",
          corFg: "var(--sec-grupos-fg)",
        },
        {
          href: "/cupons",
          label: "Radar de Cupons",
          icon: Ticket,
          corBg: "var(--sec-cupons-bg)",
          corFg: "var(--sec-cupons-fg)",
        },
        {
          href: "/crm",
          label: "Pedidos VIP",
          icon: Users,
          corBg: "var(--sec-vip-bg)",
          corFg: "var(--sec-vip-fg)",
          conta: desejosMatch,
          pendencia: true,
        },
        {
          href: "/monitor",
          label: "Monitor de Preço",
          icon: Crosshair,
          corBg: "var(--sec-monitor-bg)",
          corFg: "var(--sec-monitor-fg)",
          conta: monitoresAtingidos,
          pendencia: true,
        },
      ],
    },
    {
      nome: "Ajustes",
      itens: [
        {
          href: "/conexoes",
          label: "Conexões",
          icon: Plug,
          corBg: "var(--sec-ajustes-bg)",
          corFg: "var(--sec-ajustes-fg)",
        },
        {
          href: "/marcas",
          label: "Contas de Afiliado",
          icon: Layers,
          corBg: "var(--sec-ajustes-bg)",
          corFg: "var(--sec-ajustes-fg)",
        },
        {
          href: "/vitrine",
          label: "Vitrine Pública",
          icon: Store,
          corBg: "var(--sec-ajustes-bg)",
          corFg: "var(--sec-ajustes-fg)",
          externo: true,
        },
        {
          href: "/pedagio",
          label: "Pedágio",
          icon: Ticket,
          corBg: "var(--sec-ajustes-bg)",
          corFg: "var(--sec-ajustes-fg)",
        },
        {
          href: "/conta",
          label: "Conta",
          icon: UserCog,
          corBg: "var(--sec-ajustes-bg)",
          corFg: "var(--sec-ajustes-fg)",
        },
      ],
    },
  ];

  const isAtivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const canalConectado = status.whatsapp || status.telegram;
  const pendencias = (temTagReal ? 0 : 1) + (canalConectado ? 0 : 1);
  const hrefPendencia = !temTagReal ? "/marcas" : "/conexoes";

  const miniCanais = [
    { id: "wa", title: "WhatsApp", ok: status.whatsapp, icon: MessageCircle, bg: "#dcfce7", fg: "#15803d" },
    { id: "tg", title: "Telegram", ok: status.telegram, icon: Send, bg: "#dbeafe", fg: "#1d4ed8" },
    { id: "ft", title: "Fontes", ok: status.fontes, icon: Radio, bg: "#ffedd5", fg: "#c2410c" },
    { id: "vt", title: "Vitrine", ok: status.vitrine, icon: Store, bg: "#f3e8ff", fg: "#7e22ce" },
  ];

  const conteudo = (mini: boolean) => (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-superficie/92 backdrop-blur-md"
      />

      {/* Topo: robô + pega-oferta + subtítulo + botão de lua */}
      <div
        className={`flex h-[70px] shrink-0 items-center ${
          mini ? "justify-center px-0" : "justify-between px-4"
        }`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-9 w-9 shrink-0 rounded-[11px] object-cover"
            />
          ) : (
            <AvatarLogo size={36} className="shrink-0" />
          )}
          {!mini && (
            <span className="min-w-0">
              <span className="display block truncate text-[18px] font-extrabold leading-none tracking-[-0.03em] text-tinta">
                pega-oferta
              </span>
              <span className="mt-1 block truncate text-[11px] font-medium text-tinta-3">
                ofertas no automático
              </span>
            </span>
          )}
        </Link>
        {!mini && <BotaoTemaLua />}
      </div>

      {/* Card da conta / operação */}
      {!mini && (
        <div className="mx-3 mb-4 rounded-[15px] bg-fundo/85 p-3 shadow-[0_1px_2px_rgba(24,22,20,0.04)]">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold leading-tight text-tinta">
              {nomeOperacao || "Pega Oferta"}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-tinta-3">
              {status.whatsapp && waNumero
                ? formatarNumeroWa(waNumero)
                : arrobaMarca || "Sua operação"}
            </p>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-linha pt-2.5">
            <div className="flex items-center gap-1">
              {miniCanais.map((c) => {
                const Icon = c.icon;
                return (
                  <span
                    key={c.id}
                    title={`${c.title}: ${c.ok ? "ativo" : "inativo"}`}
                    className="grid h-6 w-6 place-items-center rounded-[7px]"
                    style={
                      c.ok
                        ? { backgroundColor: c.bg, color: c.fg }
                        : { backgroundColor: "var(--rebaixo)", color: "var(--tinta-3)", opacity: 0.55 }
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                );
              })}
            </div>

            {pendencias > 0 ? (
              <Link
                href={hrefPendencia}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fogo hover:underline"
              >
                <span className="h-2 w-2 rounded-full bg-fogo" />
                <span>
                  {pendencias === 1 ? "1 pendência" : `${pendencias} pendências`}
                </span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-tinta-2">
                <span
                  className={`h-2 w-2 rounded-full ${modoTeste ? "bg-alerta" : "bg-ok"}`}
                />
                <span>{modoTeste ? "Simulação" : "Produção"}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Navegação com quadradinhos coloridos e item ativo branco + barrinha laranja */}
      <nav
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-1"
        aria-label="Menu principal"
      >
        {grupos.map((grupo) => (
          <div key={grupo.nome}>
            {!mini && (
              <p className="mb-1.5 px-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-tinta-3">
                {grupo.nome}
              </p>
            )}
            <div className="space-y-1">
              {grupo.itens.map((item) => {
                const Icon = item.icon;
                const ativo = !item.externo && isAtivo(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.externo ? "_blank" : undefined}
                    title={mini ? item.label : undefined}
                    className={`group relative flex min-h-[40px] items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-[13.5px] transition ${
                      mini ? "justify-center px-0" : ""
                    } ${
                      ativo
                        ? "bg-superficie font-bold text-tinta shadow-[var(--sombra)]"
                        : "font-medium text-tinta-2 hover:bg-rebaixo/70 hover:text-tinta"
                    }`}
                  >
                    {/* Barrinha laranja à esquerda no item ativo */}
                    {ativo && !mini && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-5 w-[3.5px] -translate-y-1/2 rounded-r-full bg-fogo"
                      />
                    )}

                    {/* Ícone dentro de quadradinho colorido */}
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] transition"
                      style={{ backgroundColor: item.corBg, color: item.corFg }}
                    >
                      <Icon className="h-[15px] w-[15px]" />
                    </span>

                    {!mini && <span className="flex-1 truncate">{item.label}</span>}

                    {!mini && item.href === "/pedagio" && pedagioPendente && <Cancela />}
                    {mini && item.href === "/pedagio" && pedagioPendente && (
                      <span className="pulso-pedagio absolute right-1 top-1 h-2 w-2 rounded-full bg-[#e3ad35]" />
                    )}

                    {!mini && item.conta !== undefined && item.conta > 0 && (
                      <span
                        className="num grid min-w-[20px] place-items-center rounded-full bg-rebaixo px-1.5 py-0.5 text-[11px] font-bold leading-none text-tinta-2"
                      >
                        {item.conta}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé discreto (sem seletor Auto/Claro/Escuro) */}
      <div
        className={`border-t border-linha px-4 py-3 ${
          mini ? "flex justify-center px-2" : "flex items-center justify-between"
        }`}
      >
        {mini ? (
          <BotaoTemaLua />
        ) : (
          <>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-tinta-3">
              Projeto aberto
            </span>
            <span className="num text-[11px] text-tinta-3">v4.0 · MIT</span>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside
        className="menu-lateral fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-linha lg:flex"
        style={{ width: "var(--menu)" }}
        aria-label="Menu lateral"
      >
        <div
          className={`relative isolate flex min-h-0 flex-1 flex-col ${
            recolhido ? "" : "overflow-hidden"
          }`}
        >
          {conteudo(recolhido)}
        </div>
        <button
          type="button"
          onClick={alternar}
          aria-label={recolhido ? "Abrir o menu" : "Recolher o menu"}
          title={`${recolhido ? "Abrir" : "Recolher"} o menu (Ctrl+B)`}
          className="absolute -right-[13px] top-1/2 z-10 grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-full border border-linha-forte bg-superficie text-tinta-2 shadow-[var(--sombra-alta)] transition hover:scale-110 hover:bg-tinta hover:text-fundo"
        >
          <ChevronLeft
            className={`h-3.5 w-3.5 transition-transform duration-300 ${
              recolhido ? "rotate-180" : ""
            }`}
            strokeWidth={2.5}
          />
        </button>
      </aside>

      {/* Barra mobile */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-linha bg-superficie/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <AvatarLogo size={30} />
          <span className="display text-[17px] font-extrabold tracking-[-0.03em] text-tinta">
            pega-oferta
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <BotaoTemaLua />
          <button
            type="button"
            onClick={() => setAbertoMobile(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-rebaixo px-3 text-xs font-semibold text-tinta"
          >
            <MenuIcon className="h-4 w-4" />
            <span>Menu</span>
          </button>
        </div>
      </div>

      {abertoMobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAbertoMobile(false)}
            className="absolute inset-0 bg-black/35"
          />
          <aside className="relative isolate flex h-full w-[min(86vw,300px)] flex-col overflow-hidden border-r border-linha bg-superficie shadow-2xl">
            <button
              type="button"
              onClick={() => setAbertoMobile(false)}
              aria-label="Fechar"
              className="absolute right-3 top-4 z-20 grid h-8 w-8 place-items-center rounded-lg border border-linha bg-superficie text-tinta-2"
            >
              <X className="h-4 w-4" />
            </button>
            {conteudo(false)}
          </aside>
        </div>
      )}
    </>
  );
}

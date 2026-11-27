"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import { AvatarLogo } from "@/components/ui/avatar-logo";
import {
  Check,
  Copy,
  GitBranch,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

interface GrupoCascata {
  id: string;
  campanha_slug: string;
  campanha_nome: string;
  ordem: number;
  nome_grupo: string;
  link_convite: string;
  membros_atuais: number;
  limite_membros: number;
  cliques: number;
}

interface GrupoWa {
  jid: string;
  nome: string;
  participantes: number;
  souAdmin?: boolean;
}

export default function CascataPage() {
  const [grupos, setGrupos] = useState<GrupoCascata[]>([]);
  const [todosWa, setTodosWa] = useState<GrupoWa[]>([]);
  const [abaWa, setAbaWa] = useState<"admin" | "todos">("admin");
  const [waConectado, setWaConectado] = useState(false);
  const [importandoJid, setImportandoJid] = useState<string | null>(null);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiadoSlug, setCopiadoSlug] = useState<string | null>(null);

  const [slug, setSlug] = useState("vip");
  const [campanhaNome, setCampanhaNome] = useState("Meus Grupos VIP");
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [linkConvite, setLinkConvite] = useState("");
  const [membros, setMembros] = useState("0");
  const [limite, setLimite] = useState("1000");

  const carregar = useCallback(async () => {
    const [resCas, resWa] = await Promise.all([
      fetch("/api/cascata"),
      fetch("/api/whatsapp/baileys").catch(() => null),
    ]);
    const dCas = (await resCas.json()) as { grupos: GrupoCascata[] };
    setGrupos(dCas.grupos || []);

    if (resWa && resWa.ok) {
      const dWa = (await resWa.json()) as { estado?: string; grupos?: GrupoWa[] };
      setWaConectado(dWa.estado === "conectado");
      setTodosWa(dWa.grupos || []);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function importarDoWhatsApp(g: GrupoWa) {
    setImportandoJid(g.jid);
    setAviso(null);
    try {
      const resConv = await fetch(`/api/whatsapp/baileys?convite=${encodeURIComponent(g.jid)}`);
      const conv = (await resConv.json().catch(() => ({}))) as { link?: string; erro?: string };
      if (!conv.link) {
        setAviso(
          `O WhatsApp nao liberou o link de convite de "${g.nome}" (${conv.erro || "voce precisa ser admin desse grupo"}). Voce pode adicionar o link manualmente.`
        );
        setNomeGrupo(g.nome);
        setMembros(String(g.participantes));
        setGavetaAberta(true);
        return;
      }

      await fetch("/api/cascata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campanha_slug: "meus-grupos",
          campanha_nome: "Meus Grupos Oficiais",
          nome_grupo: g.nome,
          link_convite: conv.link,
          membros_atuais: g.participantes,
          limite_membros: 1000,
        }),
      });
      setAviso(`Grupo "${g.nome}" adicionado com link de convite oficial!`);
      await carregar();
    } finally {
      setImportandoJid(null);
    }
  }

  async function adicionarManual(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/cascata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campanha_slug: slug.trim().toLowerCase(),
        campanha_nome: campanhaNome.trim(),
        nome_grupo: nomeGrupo.trim(),
        link_convite: linkConvite.trim(),
        membros_atuais: Number(membros) || 0,
        limite_membros: Number(limite) || 1000,
      }),
    });
    if (res.ok) {
      setNomeGrupo("");
      setLinkConvite("");
      setGavetaAberta(false);
      setAviso("Grupo adicionado a cascata.");
      await carregar();
    }
  }

  async function remover(id: string) {
    await fetch(`/api/cascata?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await carregar();
  }

  function copiarLink(campSlug: string) {
    const url = `${window.location.origin}/entrar/${campSlug}`;
    navigator.clipboard.writeText(url);
    setCopiadoSlug(campSlug);
    setTimeout(() => setCopiadoSlug(null), 1500);
  }

  const adminsWa = todosWa.filter((g) => g.souAdmin);
  const listaExibida = abaWa === "admin" ? adminsWa : todosWa;

  const porCampanha = grupos.reduce<Record<string, GrupoCascata[]>>((acc, g) => {
    const k = g.campanha_slug;
    if (!acc[k]) acc[k] = [];
    acc[k]!.push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="SEUS GRUPOS · REDIRECIONADOR"
        titulo="Meus Grupos."
        subtitulo="Gerencie os grupos onde voce e administrador e monte links de convite em cascata (quando um lota, o link joga pro proximo)."
        acoes={
          <>
            <button
              type="button"
              onClick={() => carregar()}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:bg-rebaixo"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Sincronizar</span>
            </button>
            <button
              type="button"
              onClick={() => setGavetaAberta(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar grupo</span>
            </button>
          </>
        }
      />

      {aviso && (
        <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-suave px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* BLOCO 1: GRUPOS REAIS DO WHATSAPP (FILTRO ADMIN POR PADRAO) */}
      <section className="caixa overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-tinta">
              Grupos do seu WhatsApp
            </h2>
            <p className="text-xs text-tinta-3">
              Mostrando apenas grupos reais da sua conta conectada.
            </p>
          </div>

          <div className="flex rounded-[9px] border border-linha bg-fundo p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAbaWa("admin")}
              className={`rounded-[7px] px-3 py-1 font-semibold transition ${
                abaWa === "admin"
                  ? "bg-superficie text-tinta shadow-[var(--sombra)]"
                  : "text-tinta-3 hover:text-tinta"
              }`}
            >
              Onde sou Admin ({adminsWa.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaWa("todos")}
              className={`rounded-[7px] px-3 py-1 font-semibold transition ${
                abaWa === "todos"
                  ? "bg-superficie text-tinta shadow-[var(--sombra)]"
                  : "text-tinta-3 hover:text-tinta"
              }`}
            >
              Todos ({todosWa.length})
            </button>
          </div>
        </div>

        {!waConectado ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <Users className="h-8 w-8 text-tinta-3" />
            <p className="mt-3 text-sm font-semibold text-tinta">WhatsApp nao conectado</p>
            <Link
              href="/conexoes"
              className="mt-3 inline-flex h-9 items-center rounded-[9px] bg-acao px-4 text-xs font-semibold text-acao-texto"
            >
              Conectar WhatsApp
            </Link>
          </div>
        ) : listaExibida.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <Shield className="h-8 w-8 text-tinta-3" />
            <p className="mt-3 text-sm font-semibold text-tinta">
              {abaWa === "admin"
                ? "Nenhum grupo encontrado onde este numero e administrador"
                : "Nenhum grupo encontrado nessa conta"}
            </p>
            <p className="mt-1 max-w-md text-xs text-tinta-3">
              {abaWa === "admin"
                ? "Se voce cria seus grupos em outro numero ou comunidade, clique em 'Todos' acima ou adicione o link de convite pelo botao 'Adicionar grupo'."
                : "Entre ou crie um grupo no WhatsApp conectado e clique em Sincronizar."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {listaExibida.map((g) => (
              <div
                key={g.jid}
                className="flex flex-col justify-between rounded-[11px] border border-linha bg-fundo/50 p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold text-tinta">{g.nome}</p>
                    {g.souAdmin && (
                      <span className="selo selo-ok shrink-0">Admin</span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-tinta-3">
                    <Users className="h-3.5 w-3.5" />
                    <span className="num">{g.participantes} membros</span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={importandoJid === g.jid}
                  onClick={() => importarDoWhatsApp(g)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie text-xs font-semibold text-tinta transition hover:border-fogo hover:text-fogo disabled:opacity-50"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>
                    {importandoJid === g.jid ? "Puxando link..." : "Adicionar a Cascata"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* BLOCO 2: LINKS DE CASCATA CRIADOS POR VOCE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-tinta">
              Links em Cascata (/entrar/[slug])
            </h2>
            <p className="text-xs text-tinta-3">
              Coloque 1 link unico na bio ou anuncio — quando o Grupo #1 lotar, ele joga automaticamente pro Grupo #2.
            </p>
          </div>
        </div>

        {Object.keys(porCampanha).length === 0 ? (
          <div className="caixa flex flex-col items-center justify-center p-12 text-center">
            <AvatarLogo size={68} mood="idle" />
            <p className="mt-4 font-display text-base font-extrabold text-tinta">
              Nenhuma cascata criada ainda
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-tinta-3">
              Importe um grupo do WhatsApp acima ou adicione seu primeiro link de convite para montar seu redirecionador automático.
            </p>
            <button
              type="button"
              onClick={() => setGavetaAberta(true)}
              className="btn-primario mt-5"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar primeiro grupo</span>
            </button>
          </div>
        ) : (
          Object.entries(porCampanha).map(([campSlug, itens]) => (
            <div key={campSlug} className="caixa overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-fundo/50 px-5 py-3.5">
                <div>
                  <h3 className="font-display text-sm font-bold text-tinta">
                    {itens[0]?.campanha_nome || campSlug}
                  </h3>
                  <p className="font-mono text-xs text-tinta-3">/entrar/{campSlug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copiarLink(campSlug)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta hover:bg-rebaixo"
                >
                  {copiadoSlug === campSlug ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-ok" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar link unico</span>
                    </>
                  )}
                </button>
              </div>

              <div className="divide-y divide-linha">
                {itens.map((g) => {
                  const pct = Math.min(100, Math.round((g.membros_atuais / Math.max(1, g.limite_membros)) * 100));
                  return (
                    <div key={g.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-tinta">{g.nome_grupo}</p>
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-rebaixo">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? "bg-erro" : "bg-ok"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="num text-xs text-tinta-3">
                            {g.membros_atuais}/{g.limite_membros} ({pct}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="num text-xs text-tinta-3">{g.cliques} cliques</span>
                        <button
                          type="button"
                          onClick={() => remover(g.id)}
                          className="grid h-8 w-8 place-items-center rounded-[8px] border border-linha text-tinta-3 hover:text-erro"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      <Gaveta
        aberta={gavetaAberta}
        onFechar={() => setGavetaAberta(false)}
        titulo="Adicionar grupo a cascata"
        subtitulo="Informe o link de convite oficial (chat.whatsapp.com/...)."
      >
        <form onSubmit={adicionarManual} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">Slug do link</label>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="vip"
                className="campo font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">Campanha</label>
              <input
                required
                value={campanhaNome}
                onChange={(e) => setCampanhaNome(e.target.value)}
                placeholder="Meus Grupos VIP"
                className="campo"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Nome do grupo</label>
            <input
              required
              value={nomeGrupo}
              onChange={(e) => setNomeGrupo(e.target.value)}
              placeholder="Ex: Ofertas Tech #01"
              className="campo"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Link de convite</label>
            <input
              required
              type="url"
              value={linkConvite}
              onChange={(e) => setLinkConvite(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="campo"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">Membros atuais</label>
              <input
                type="number"
                value={membros}
                onChange={(e) => setMembros(e.target.value)}
                className="campo"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">Limite</label>
              <input
                type="number"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                className="campo"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Salvar grupo</span>
          </button>
        </form>
      </Gaveta>
    </div>
  );
}

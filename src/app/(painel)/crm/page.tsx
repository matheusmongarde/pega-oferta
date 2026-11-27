"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import {
  Check,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

interface OfertaMatch {
  id: string;
  titulo: string;
  preco: number;
  cupom: string;
  url_afiliado: string;
  imagem_url?: string;
}

interface CrmContato {
  id: string;
  nome: string;
  telefone: string;
  tags: string;
  desejo_produto: string;
  desejo_preco_max: number;
  status: "ativo" | "avisado" | "converteu";
  notas: string;
  ofertas_match: OfertaMatch[];
}

const CORES_AVATAR = ["#F06526", "#2563EB", "#16A34A", "#9333EA", "#DB2777", "#0891B2"];

function iniciais(nome: string) {
  const partes = (nome || "VIP").trim().split(/\s+/);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || partes[0]?.[1] || "")).toUpperCase() || "VP";
}

function corAvatar(nome: string) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function CrmPage() {
  const [contatos, setContatos] = useState<CrmContato[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [gaveta, setGaveta] = useState(false);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tags, setTags] = useState("");
  const [desejo, setDesejo] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [notas, setNotas] = useState("");

  const carregar = useCallback(async () => {
    const res = await fetch("/api/crm");
    const data = (await res.json()) as { contatos: CrmContato[] };
    setContatos(data.contatos || []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        telefone,
        tags,
        desejo_produto: desejo,
        desejo_preco_max: Number(precoMax) || 0,
        notas,
      }),
    });
    setNome("");
    setTelefone("");
    setTags("");
    setDesejo("");
    setPrecoMax("");
    setNotas("");
    setGaveta(false);
    await carregar();
  }

  async function avisarNoWhatsapp(c: CrmContato, oferta: OfertaMatch) {
    setEnviandoId(`${c.id}-${oferta.id}`);
    setAvisoEnvio(null);
    try {
      const res = await fetch("/api/crm/avisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contato_id: c.id, oferta_id: oferta.id }),
      });
      const d = (await res.json()) as { ok?: boolean; erro?: string };
      setAvisoEnvio(
        d.ok
          ? `Alerta enviado no WhatsApp de ${c.nome}!`
          : d.erro || "Não foi possível enviar no WhatsApp agora."
      );
      await carregar();
    } finally {
      setEnviandoId(null);
    }
  }

  async function marcarStatus(id: string, status: CrmContato["status"]) {
    await fetch("/api/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await carregar();
  }

  async function remover(id: string) {
    await fetch(`/api/crm?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await carregar();
  }

  const visiveis = contatos.filter((c) => {
    if (filtro === "com_match") return (c.ofertas_match || []).length > 0;
    if (filtro === "avisado") return c.status === "avisado";
    if (filtro === "converteu") return c.status === "converteu";
    return true;
  });

  const totalMatches = contatos.filter((c) => (c.ofertas_match || []).length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="ENCOMENDAS NO PRIVADO · WHATSAPP"
        titulo="Pedidos VIP."
        subtitulo="Quando um seguidor pede um produto no privado do seu WhatsApp (ex: 'quero SSD até 400'), ele entra aqui e acende em verde assim que a oferta aparecer."
        acoes={
          <button
            type="button"
            onClick={() => setGaveta(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Novo pedido VIP</span>
          </button>
        }
      />

      {avisoEnvio && (
        <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-suave px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{avisoEnvio}</span>
        </div>
      )}

      {/* Filtros rapidos */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "todos", label: `Todos (${contatos.length})` },
            { id: "com_match", label: `Com oferta pronta (${totalMatches})` },
            { id: "avisado", label: "Já avisados" },
            { id: "converteu", label: "Comprou" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`h-9 rounded-full px-4 text-xs font-semibold transition ${
              filtro === f.id
                ? "bg-acao text-acao-texto"
                : "border border-linha bg-superficie text-tinta-2 hover:text-tinta"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div className="caixa flex flex-col items-center justify-center p-12 text-center">
          <Users className="h-8 w-8 text-tinta-3" />
          <p className="mt-3 text-sm font-semibold text-tinta">Nenhum pedido VIP neste filtro</p>
          <p className="mt-1 max-w-md text-xs text-tinta-3">
            Quem mandar no privado do seu WhatsApp conectado &ldquo;quero Air Fryer até 300&rdquo; entra aqui sozinho.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((c) => {
            const match = c.ofertas_match?.[0];
            const cor = corAvatar(c.nome);
            return (
              <article
                key={c.id}
                className={`caixa caixa-viva flex flex-col justify-between overflow-hidden ${
                  match ? "ring-1 ring-ok/40" : ""
                }`}
              >
                {/* Topo com perfil do cliente VIP */}
                <div className="flex items-center justify-between gap-3 border-b border-linha bg-fundo/50 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white"
                      style={{ backgroundColor: cor }}
                    >
                      {iniciais(c.nome)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-tinta">{c.nome}</p>
                      <p className="truncate font-mono text-[11px] text-tinta-3">
                        {c.telefone || "Sem WhatsApp"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`selo ${
                      match ? "selo-ok" : c.status === "converteu" ? "selo-ok" : ""
                    }`}
                  >
                    {match ? "Achou!" : c.status}
                  </span>
                </div>

                {/* Balao do pedido */}
                <div className="flex-1 space-y-3 p-4">
                  <div className="rounded-[12px] rounded-tl-none border border-linha bg-fundo px-3.5 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-3">
                      Procurando
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-tinta">
                      {c.desejo_produto || "Produto não informado"}
                    </p>
                    {c.desejo_preco_max > 0 && (
                      <p className="mt-1 text-xs font-semibold text-fogo">
                        Até {brl(c.desejo_preco_max)}
                      </p>
                    )}
                  </div>

                  {match ? (
                    <div className="flex items-center gap-3 rounded-[12px] border border-ok/30 bg-ok-suave/60 p-3">
                      {match.imagem_url ? (
                        <img
                          src={match.imagem_url}
                          alt={match.titulo}
                          className="h-14 w-14 shrink-0 rounded-[9px] border border-ok/20 bg-superficie object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[9px] bg-ok/15 text-ok">
                          <Sparkles className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-ok">
                          <span>Oferta pronta</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-tinta">
                          {match.titulo}
                        </p>
                        <p className="num mt-1 text-xs font-extrabold text-ok">
                          {brl(match.preco)} {match.cupom ? `· ${match.cupom}` : ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-tinta-3">
                      Vigiando novas ofertas em tempo real — assim que bater o preço, aparece aqui.
                    </p>
                  )}
                </div>

                {/* Acoes */}
                <div className="flex items-center justify-between gap-2 border-t border-linha bg-fundo/40 px-4 py-3">
                  {match && c.telefone ? (
                    <button
                      type="button"
                      disabled={enviandoId === `${c.id}-${match.id}`}
                      onClick={() => avisarNoWhatsapp(c, match)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-[#16A34A] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#15803d] disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>
                        {enviandoId === `${c.id}-${match.id}` ? "Enviando..." : "Enviar no WhatsApp"}
                      </span>
                    </button>
                  ) : c.telefone ? (
                    <a
                      href={`https://wa.me/${c.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-linha-forte bg-superficie px-3 py-2 text-xs font-semibold text-tinta hover:bg-rebaixo"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#16A34A]" />
                      <span>Abrir WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-xs text-tinta-3">Adicione o telefone</span>
                  )}

                  {c.status !== "converteu" && (
                    <button
                      type="button"
                      onClick={() => marcarStatus(c.id, "converteu")}
                      title="Marcar que comprou"
                      className="grid h-8 w-8 place-items-center rounded-[8px] border border-linha bg-superficie text-tinta-3 hover:text-ok"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remover(c.id)}
                    title="Remover"
                    className="grid h-8 w-8 place-items-center rounded-[8px] border border-linha bg-superficie text-tinta-3 hover:text-erro"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Gaveta
        aberta={gaveta}
        onFechar={() => setGaveta(false)}
        titulo="Novo pedido VIP"
        subtitulo="Cadastre o que o cliente quer comprar para avisar no WhatsApp quando cair o preço."
      >
        <form onSubmit={adicionar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Nome</label>
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lucas" className="campo" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">WhatsApp (com DDD)</label>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="5511999999999" className="campo font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Produto desejado</label>
            <input required value={desejo} onChange={(e) => setDesejo(e.target.value)} placeholder="Ex: SSD 1TB ou Air Fryer" className="campo" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Preço máximo (R$)</label>
            <input type="number" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="350" className="campo" />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Salvar pedido VIP</span>
          </button>
        </form>
      </Gaveta>
    </div>
  );
}

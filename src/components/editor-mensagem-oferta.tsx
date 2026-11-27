"use client";

import { useRef, useState } from "react";
import { Check, MessageSquareText, Save, Sparkles } from "lucide-react";

interface Props {
  marcaId: string;
  marcaNome: string;
  templateInicial: string;
  onSalvo?: (novoTemplate: string) => void;
}

const VARIAVEIS: Array<{ chave: string; label: string; exemplo: string }> = [
  { chave: "{{titulo}}", label: "Título", exemplo: "Fone JBL Tune 520BT Bluetooth" },
  { chave: "{{loja}}", label: "Loja", exemplo: "Amazon" },
  { chave: "{{bloco_preco}}", label: "Bloco Preço", exemplo: "De ~R$ 299,00~ por *R$ 179,90* (-40%)" },
  { chave: "{{preco}}", label: "Preço atual", exemplo: "R$ 179,90" },
  { chave: "{{preco_antigo}}", label: "Preço antigo", exemplo: "R$ 299,00" },
  { chave: "{{desconto}}", label: "Desconto %", exemplo: "40%" },
  { chave: "{{economia}}", label: "Economia R$", exemplo: "R$ 119,10" },
  { chave: "{{parcelas}}", label: "Parcelas", exemplo: "10x de R$ 17,99 sem juros" },
  { chave: "{{bloco_cupom}}", label: "Bloco Cupom", exemplo: "🏷️ Cupom: `JBL15`" },
  { chave: "{{cupom}}", label: "Só o código", exemplo: "JBL15" },
  { chave: "{{link}}", label: "Link afiliado", exemplo: "https://amzn.to/pega-oferta" },
  { chave: "{{marca}}", label: "Sua marca", exemplo: "Pega Oferta" },
  { chave: "{{vitrine}}", label: "Sua vitrine", exemplo: "https://seusite.com/vitrine" },
];

const PRESETS: Array<{ nome: string; texto: string }> = [
  {
    nome: "Padrão Limpo",
    texto: `🔥 *{{titulo}}*\n\n💰 {{bloco_preco}}\n{{bloco_cupom}}\n🏪 Loja: {{loja}}\n\n🛒 *Compre aqui:* {{link}}`,
  },
  {
    nome: "Urgente / Relâmpago",
    texto: `🚨 *BAIXOU MUITO na {{loja}}!*\n\n*{{titulo}}*\n\n💸 De ~{{preco_antigo}}~ por *{{preco}}* ({{desconto}} OFF)\n✨ Você economiza *{{economia}}*\n{{bloco_cupom}}\n\n👉 Garanta antes que acabe:\n{{link}}`,
  },
  {
    nome: "Minimalista",
    texto: `*{{titulo}}*\n{{bloco_preco}}\n{{bloco_cupom}}\n{{link}}`,
  },
  {
    nome: "Completo c/ Parcelas",
    texto: `⚡ *{{titulo}}*\n\n💰 {{bloco_preco}}\n💳 {{parcelas}}\n{{bloco_cupom}}\n🏪 {{loja}}\n\n🔗 *Link oficial:* {{link}}\n\n_{{marca}}_`,
  },
];

function renderPreview(template: string, comCupom: boolean, marcaNome: string): string {
  const mapa: Record<string, string> = {
    "{{titulo}}": "Fone JBL Tune 520BT Bluetooth 57h",
    "{{loja}}": "Amazon",
    "{{bloco_preco}}": "De ~R$ 299,00~ por *R$ 179,90* (-40%)",
    "{{preco}}": "R$ 179,90",
    "{{preco_antigo}}": "R$ 299,00",
    "{{desconto}}": "40%",
    "{{economia}}": "R$ 119,10",
    "{{parcelas}}": "10x de R$ 17,99 sem juros",
    "{{bloco_cupom}}": comCupom ? "🏷️ Cupom: `JBL15`" : "",
    "{{cupom}}": comCupom ? "JBL15" : "",
    "{{link}}": "https://www.amazon.com.br/dp/B0C1.../?tag=seucanal-20",
    "{{marca}}": marcaNome || "Pega Oferta",
    "{{vitrine}}": "http://localhost:3000/vitrine",
  };

  const linhas = template.split(/\r?\n/);
  const saida: string[] = [];
  for (const linha of linhas) {
    const vars = linha.match(/\{\{[a-z_]+\}\}/g) || [];
    let s = linha;
    for (const [k, v] of Object.entries(mapa)) s = s.replaceAll(k, v);
    if (vars.length > 0 && !vars.some((v) => Boolean(mapa[v]))) continue;
    saida.push(s.replace(/[ \t]+$/g, ""));
  }
  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function formatarLinhaWhatsApp(linha: string) {
  const partes = linha.split(/(\*[^*]+\*|~[^~]+~|`[^`]+`|_[^_]+_)/g);
  return partes.map((p, idx) => {
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <strong key={idx}>{p.slice(1, -1)}</strong>;
    }
    if (p.startsWith("~") && p.endsWith("~") && p.length > 2) {
      return (
        <span key={idx} className="line-through opacity-65">
          {p.slice(1, -1)}
        </span>
      );
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <code key={idx} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px] font-bold">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
      return <em key={idx}>{p.slice(1, -1)}</em>;
    }
    return <span key={idx}>{p}</span>;
  });
}

export function EditorMensagemOferta({
  marcaId,
  marcaNome,
  templateInicial,
  onSalvo,
}: Props) {
  const [template, setTemplate] = useState(templateInicial || PRESETS[0].texto);
  const [comCupom, setComCupom] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function inserirVariavel(chave: string) {
    const el = textareaRef.current;
    if (!el) {
      setTemplate((t) => `${t}${t.endsWith(" ") || !t ? "" : " "}${chave}`);
      return;
    }
    const inicio = el.selectionStart ?? template.length;
    const fim = el.selectionEnd ?? template.length;
    const novo = template.slice(0, inicio) + chave + template.slice(fim);
    setTemplate(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + chave.length, inicio + chave.length);
    });
  }

  async function salvar() {
    setSalvando(true);
    setSalvoOk(false);
    try {
      const res = await fetch(`/api/marcas/${marcaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_mensagem: template }),
      });
      if (res.ok) {
        setSalvoOk(true);
        onSalvo?.(template);
        setTimeout(() => setSalvoOk(false), 3000);
      }
    } finally {
      setSalvando(false);
    }
  }

  const previewTexto = renderPreview(template, comCupom, marcaNome);

  return (
    <section id="modelo-mensagem" className="caixa p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-fogo" />
            <h2 className="font-display text-base font-extrabold text-tinta">
              Modelo da Mensagem nos Grupos
            </h2>
          </div>
          <p className="mt-1 text-xs text-tinta-3">
            Personalize exatamente como cada oferta cai no WhatsApp e Telegram. Linhas com variáveis vazias (ex.: oferta sem cupom) somem automaticamente.
          </p>
        </div>

        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-50"
        >
          {salvoOk ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          <span>{salvando ? "Salvando..." : salvoOk ? "Modelo salvo!" : "Salvar modelo"}</span>
        </button>
      </div>

      {/* Presets prontos */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-tinta-3">
          <Sparkles className="h-3 w-3" />
          Presets:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.nome}
            type="button"
            onClick={() => setTemplate(p.texto)}
            className="rounded-full border border-linha-forte bg-fundo px-3 py-1 text-xs font-semibold text-tinta-2 transition hover:border-tinta hover:text-tinta"
          >
            {p.nome}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Coluna Esquerda: Editor + Chips de Variaveis */}
        <div className="space-y-3 lg:col-span-7">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-tinta-3">
              Clique para inserir uma variável no texto:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VARIAVEIS.map((v) => (
                <button
                  key={v.chave}
                  type="button"
                  onClick={() => inserirVariavel(v.chave)}
                  title={`Exemplo: ${v.exemplo}`}
                  className="rounded-[7px] border border-linha bg-fundo px-2 py-1 font-mono text-[11px] font-semibold text-tinta transition hover:border-fogo hover:text-fogo"
                >
                  {v.chave}
                </button>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            rows={9}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="campo font-mono text-xs leading-relaxed"
            placeholder="Escreva o modelo da mensagem..."
          />
          <p className="text-[11px] text-tinta-3">
            Formatação do WhatsApp: <code>*negrito*</code>, <code>~riscado~</code>,{" "}
            <code>_itálico_</code> e <code>`cupom`</code>.
          </p>
        </div>

        {/* Coluna Direita: Preview ao vivo estilo WhatsApp */}
        <div className="flex flex-col lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-tinta-3">
              Preview ao vivo no WhatsApp
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-tinta-2">
              <input
                type="checkbox"
                checked={comCupom}
                onChange={(e) => setComCupom(e.target.checked)}
                className="h-3.5 w-3.5 accent-fogo"
              />
              <span>Simular com cupom</span>
            </label>
          </div>

          <div className="flex-1 rounded-[16px] border border-linha bg-[#efeae2] p-4">
            <div className="ml-auto max-w-[320px] overflow-hidden rounded-[12px] rounded-tr-[4px] bg-[#d9fdd3] p-2 shadow-sm">
              <div className="flex h-28 items-center justify-center rounded-[8px] bg-white/90 text-xs font-semibold text-[#57524b]">
                [Foto oficial do produto]
              </div>
              <div className="mt-2 space-y-0.5 whitespace-pre-wrap break-words px-1 text-[12.5px] leading-snug text-[#111b21]">
                {previewTexto.split("\n").map((l, i) => (
                  <p key={i} className={l === "" ? "h-2" : ""}>
                    {formatarLinhaWhatsApp(l)}
                  </p>
                ))}
              </div>
              <p className="mt-1 text-right text-[10px] text-[#667781]">19:42 ✓✓</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

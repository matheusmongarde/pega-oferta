import { ListaPedagio, type ItemPedagio } from "@/components/pedagio-lista";
import { AvatarLogo } from "@/components/ui/avatar-logo";

const ITENS: ItemPedagio[] = [
  {
    id: "x",
    tag: "X",
    titulo: "Seguir o @mongarde_ no X",
    texto: "É onde saem os próximos repositórios abertos e as automações novas.",
    acao: "Seguir",
    link: "https://x.com/mongarde_",
  },
  {
    id: "mvd",
    tag: "BR",
    titulo: "Pôr o seu projeto no ranking",
    texto: "Cadastre o que você está construindo no mamaevireidev.com.br.",
    acao: "Cadastrar",
    link: "https://mamaevireidev.com.br",
  },
  {
    id: "clara",
    tag: "GH",
    titulo: "Dar uma força ao Clara Finance",
    texto: "Projeto de um amigo. Uma estrela no GitHub já ajuda muito.",
    acao: "Ajudar",
    link: "https://github.com/cesaroeduardo/clara-finance?utm_source=mamaevireidev&utm_medium=ranking&utm_campaign=clara-finance&mvd_cid=zVTQdltE9CLQS7Yf",
  },
  {
    id: "joao",
    tag: "X",
    titulo: "Seguir o @joaoedicao no X",
    texto: "Quem editou o vídeo de lançamento do pega-oferta na faixa. Dá uma moral lá.",
    acao: "Seguir",
    link: "https://x.com/joaoedicao",
  },
];

export default function PedagioPage() {
  return (
    <section className="caixa hachura relative isolate overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--linha-forte)_1px,transparent_1.2px)] [background-size:14px_14px] [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent)] opacity-70"
        aria-hidden
      />

      <div className="flex flex-col items-center px-4 pb-10 pt-8 sm:px-10 sm:pt-12">
        {/* Ilustracao editorial da cancela + bichinho Pega-Oferta */}
        <div className="relative mb-6 flex items-center justify-center gap-4">
          <AvatarLogo size={68} mood="happy" />
          <div className="relative">
            <svg
              width="240"
              height="100"
              viewBox="0 0 280 120"
              fill="none"
              className="text-tinta"
              aria-hidden
            >
              <rect x="28" y="42" width="44" height="70" rx="10" fill="var(--superficie)" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="50" cy="64" r="9" fill="var(--rebaixo)" stroke="currentColor" strokeWidth="2.5" />
              <rect x="64" y="56" width="186" height="16" rx="8" fill="var(--superficie)" stroke="currentColor" strokeWidth="2.5" />
              <path d="M92 56L104 72M126 56L138 72M160 56L172 72M194 56L206 72M228 56L240 72" stroke="var(--fogo)" strokeWidth="6" strokeLinecap="round" />
              <line x1="12" y1="112" x2="268" y2="112" stroke="var(--linha-forte)" strokeWidth="2" strokeDasharray="6 6" />
            </svg>
            <span className="display absolute -top-2 right-2 rotate-[8deg] rounded-full bg-fogo px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-sm">
              100% Grátis
            </span>
          </div>
        </div>

        <div className="w-full max-w-[600px]">
          <div className="caixa p-6 text-center sm:p-9">
            <span className="etiqueta-secao mb-3">Pedágio</span>
            <h1 className="mx-auto max-w-[18ch] font-display text-[32px] font-extrabold leading-[1.04] tracking-[-0.03em] text-tinta sm:text-[42px]">
              Aqui ninguém passa sem pagar o pedágio.
            </h1>
            <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-tinta-2">
              O pega-oferta é aberto e grátis para sempre. O pedágio é outro: não custa nada e ajuda quem faz e quem está começando.
            </p>
            <div className="mt-7 text-left">
              <ListaPedagio itens={ITENS} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
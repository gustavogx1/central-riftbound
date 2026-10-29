/**
 * Links de busca de preço em lojas brasileiras. Só link de saída: LigaRiftbound e MyPCards
 * bloqueiam acesso automatizado e não têm API pública, então não importamos preços delas.
 */
export const priceLinks = (name: string) => [
  { store: "LigaRiftbound", href: `https://www.ligariftbound.com.br/?view=cards/search&card=${encodeURIComponent(name)}` },
  { store: "MyPCards", href: `https://mypcards.com/riftbound?ProdutoSearch%5Bquery%5D=${encodeURIComponent(name)}` },
];

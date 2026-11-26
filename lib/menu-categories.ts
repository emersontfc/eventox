export const menuCategories = [
  { id: 'doce', label: 'Doces', example: 'Ex.: Tarte de maracujá' },
  { id: 'salgado', label: 'Salgados', example: 'Ex.: Chamuças de frango' },
  { id: 'entrada', label: 'Entradas', example: 'Ex.: Salada de abacate' },
  { id: 'bebida', label: 'Bebidas', example: 'Ex.: Sumo de manga' },
  { id: 'bar', label: 'Bar e álcool', example: 'Ex.: Vinho tinto' },
] as const;

export type MenuCategory = typeof menuCategories[number]['id'];

const storedCategories: Record<string, MenuCategory> = {
  doce: 'doce', sobremesa: 'doce',
  salgado: 'salgado', lanche: 'salgado', comida: 'salgado', prato_principal: 'salgado',
  entrada: 'entrada', bebida: 'bebida', bar: 'bar',
};

export function menuCategoryId(category: string): MenuCategory | undefined {
  return Object.hasOwn(storedCategories, category) ? storedCategories[category] : undefined;
}

export function menuCategory(category: string) {
  const id = menuCategoryId(category) ?? 'salgado';
  return menuCategories.find(option => option.id === id)!;
}

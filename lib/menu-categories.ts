export const menuGroups = [
  { id: 'comidas', label: 'Comidas' },
  { id: 'bebidas', label: 'Bebidas e bar' },
] as const;

export type MenuGroup = typeof menuGroups[number]['id'];

export const menuCategories = [
  { id: 'entrada', group: 'comidas', label: 'Entradas', example: 'Ex.: Salada de abacate' },
  { id: 'prato_principal', group: 'comidas', label: 'Pratos principais', example: 'Ex.: Frango grelhado com arroz' },
  { id: 'salgado', group: 'comidas', label: 'Salgados', example: 'Ex.: Chamuças de frango' },
  { id: 'doce', group: 'comidas', label: 'Doces', example: 'Ex.: Tarte de maracujá' },
  { id: 'bebida', group: 'bebidas', label: 'Bebidas', example: 'Ex.: Sumo de manga' },
  { id: 'bar', group: 'bebidas', label: 'Bar e álcool', example: 'Ex.: Vinho tinto' },
] as const;

export type MenuCategory = typeof menuCategories[number]['id'];

const storedCategories: Record<string, MenuCategory> = {
  entrada: 'entrada', prato_principal: 'prato_principal', comida: 'prato_principal',
  salgado: 'salgado', lanche: 'salgado', doce: 'doce', sobremesa: 'doce',
  bebida: 'bebida', bar: 'bar',
};

export function menuCategoryId(category: string): MenuCategory | undefined {
  return Object.hasOwn(storedCategories, category) ? storedCategories[category] : undefined;
}

export function menuCategory(category: string) {
  const id = menuCategoryId(category) ?? 'prato_principal';
  return menuCategories.find(option => option.id === id)!;
}

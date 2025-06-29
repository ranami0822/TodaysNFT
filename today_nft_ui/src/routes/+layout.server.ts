import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url }) => {
  const addressA = url.searchParams.get('addressA') ?? ''; 
  return { addressA };
};
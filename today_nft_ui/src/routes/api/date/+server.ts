import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateString = `${yyyy}-${mm}-${dd}`;

  return new Response(JSON.stringify({ date: dateString }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
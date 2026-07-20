import { redirect } from 'next/navigation';

// Хуучин debug listing хуудас — /shop нь бүрэн product listing UI-тай учир
// давхардал арилгаж /shop руу шилжүүлнэ.
export default function ProductsRedirect() {
  redirect('/shop');
}

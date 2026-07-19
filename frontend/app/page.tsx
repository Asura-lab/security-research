import { API_BASE } from '@/lib/api';

export default function Home() {
  return (
    <section>
      <h1>security-research demo shop</h1>
      <p>Судалгааны төслийн frontend. Одоогийн backend:</p>
      <pre>NEXT_PUBLIC_API_BASE = {API_BASE || '(тохируулаагүй — main branch дээр backend-руу холбогдоогүй)'}</pre>
      <p>
        Variant branch дээр (nestjs-raw, nestjs-orm, fiber-raw, fiber-orm, fastapi-raw, fastapi-orm)
        <br />
        NEXT_PUBLIC_API_BASE-ыг тухайн backend-ийн public URL-руу заана.
      </p>
    </section>
  );
}

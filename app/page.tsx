import { isMoloniConfigured } from "@/lib/moloni";

export default function HomePage() {
  const hasBitrix = Boolean(process.env.BITRIX_WEBHOOK_URL);
  const hasRegnum = Boolean(process.env.REGNUM_TOKEN);
  const hasMoloni = isMoloniConfigured();

  const items = [
    { label: "Bitrix24 webhook", ok: hasBitrix, hint: "BITRIX_WEBHOOK_URL" },
    { label: "REGNUM API", ok: hasRegnum, hint: "REGNUM_ID / REGNUM_TOKEN" },
    { label: "Moloni API", ok: hasMoloni, hint: "MOLONI_CLIENT_ID / SECRET / USERNAME / PASSWORD / COMPANY_ID" },
  ];

  return (
    <main style={{ padding: "48px 32px", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Bitrix24 · REGNUM · Moloni — integration layer</h1>
      <p style={{ color: "#555", marginTop: 8 }}>Next.js API Middleware (без собственной БД).</p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Статус интеграций</h2>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 12 }}>
          {items.map((it) => (
            <li
              key={it.label}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{it.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{it.hint}</div>
              </div>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: it.ok ? "#ecfdf5" : "#fef2f2",
                  color: it.ok ? "#047857" : "#b91c1c",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {it.ok ? "OK" : "NOT CONFIGURED"}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18 }}>Маршруты API</h2>
        <div style={{ marginTop: 12, display: "grid", gap: 10, fontSize: 14 }}>
          <div><code>POST /api/regnum/lookup</code> — поиск авто по госномеру + опциональное обновление карточки в Bitrix</div>
          <div><code>POST /api/bitrix/webhook</code> — входящий хук из Bitrix (ONCRMDEALUPDATE, ONCRMLEADUPDATE, …)</div>
          <div><code>POST /api/bitrix/search</code> — поиск лидов/контактов (имя, марка авто)</div>
          <div><code>GET  /api/moloni/products</code> / <code>POST /api/moloni/products</code> — каталог услуг в Moloni</div>
          <div><code>POST /api/moloni/estimates</code> — формирование сметы (estimate) и отправка ссылки</div>
          <div><code>GET  /api/catalog/services</code> / <code>/api/catalog/packages</code> — локальные справочники услуг/пакетов</div>
          <div><code>GET  /api/calendar/lifts</code> / <code>/api/calendar/appointments</code> — календарь 4 подъёмника (в памяти)</div>
          <div><code>POST /api/calendar/appointments</code> — быстрое добавление записи на подъёмник</div>
        </div>
      </section>

      <footer style={{ marginTop: 64, fontSize: 12, color: "#6b7280" }}>
        Переменные окружения: <code>.env.example</code> → <code>.env.local</code>. Деплой: Vercel / GitHub.
      </footer>
    </main>
  );
}

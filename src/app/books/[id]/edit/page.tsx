import ClientPage from "./ClientPage";

// (RUNTIME EXPORT AYARLARI)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Server sarmalayıcı: client bileşenini render eder
export default function Page() {
  return <ClientPage />;
}

import ClientPage from "./ClientPage";

// (STATIK EXPORT AYARLARI – sadece SERVER dosyasında)
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: "dummy" }];
}

// Server sarmalayıcı: client bileşenini render eder
export default function Page() {
  return <ClientPage />;
}

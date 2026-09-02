import MoneyPage from "@/app/staff/money/page";

interface CompanyBooksPageProps {
  searchParams: Promise<{ error?: string; notice?: string; page?: string; q?: string; status?: string; view?: string }>;
}

export default async function CompanyBooksPage({ searchParams }: CompanyBooksPageProps) {
  const parameters = await searchParams;
  return MoneyPage({ searchParams: Promise.resolve({ ...parameters, scope: "books" }) });
}

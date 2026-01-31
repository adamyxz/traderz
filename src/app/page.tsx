import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Welcome to TraderZ</h1>
        <p className="text-gray-600 mb-8">Next.js 16 + PostgreSQL + Drizzle ORM</p>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-4">Admin Dashboard</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/admin/traders" className="text-blue-600 hover:underline">
                  Trader Management
                </Link>
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
            <h2 className="text-2xl font-semibold mb-4">API Endpoints</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/api/health" className="text-blue-600 hover:underline">
                  GET /api/health
                </Link>
              </li>
              <li>
                <Link href="/api/traders" className="text-blue-600 hover:underline">
                  GET /api/traders
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

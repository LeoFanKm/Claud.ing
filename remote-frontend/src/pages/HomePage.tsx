export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 font-semibold text-2xl text-gray-900">
          Please return to the Vibe Kanban app
        </h1>
        <p className="mb-6 text-gray-600">
          Or checkout the docs to get started
        </p>
        <a
          className="inline-block rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800"
          href="https://www.vibekanban.com/docs/getting-started"
          rel="noopener noreferrer"
          target="_blank"
        >
          View Documentation
        </a>
      </div>
    </div>
  );
}

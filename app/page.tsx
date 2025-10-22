import { FilePicker } from '@/components/file-picker/file-picker';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            Google Drive Knowledge Base Picker
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Browse your connected Google Drive, select the files and folders you want to index,
            and manage their indexing state with real-time feedback and optimistic updates.
          </p>
        </header>
        <FilePicker />
      </div>
    </main>
  );
}

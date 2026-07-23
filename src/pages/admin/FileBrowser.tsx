import { B2FileBrowser } from "@/components/admin/B2FileBrowser";

export default function FileBrowser() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">File Manager</h1>
        <p className="text-muted-foreground mt-2">
          Browse and manage all uploaded files in Backblaze B2 storage
        </p>
      </div>

      <B2FileBrowser />
    </div>
  );
}

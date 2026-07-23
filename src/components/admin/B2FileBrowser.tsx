import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useB2Files } from "@/hooks/useB2Files";
import {
  Folder,
  File,
  ChevronRight,
  Home,
  Trash2,
  RefreshCw,
  ExternalLink,
  Loader2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

function ViewButton({ fileName }: { fileName: string }) {
  const handleView = () => {
    // Navigate to dedicated PDF viewer page (avoids Chrome blocking)
    const encodedPath = encodeURIComponent(fileName);
    window.open(`/admin/pdf-viewer?path=${encodedPath}`, "_blank");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleView}
      title="View file"
    >
      <ExternalLink className="h-4 w-4" />
    </Button>
  );
}

export function B2FileBrowser() {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<{ fileName: string; fileId: string } | null>(null);
  const queryClient = useQueryClient();

  const { files, folders, isLoading, deleteFile, isDeleting } = useB2Files(currentPath);

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const navigateToFolder = (folderName: string) => {
    setCurrentPath(folderName);
  };

  const navigateUp = (index: number) => {
    if (index === -1) {
      setCurrentPath("");
    } else {
      const newPath = pathParts.slice(0, index + 1).join('/');
      setCurrentPath(newPath);
    }
  };

  const handleDelete = (fileName: string, fileId: string) => {
    setDeleteTarget({ fileName, fileId });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteFile(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['b2-files', currentPath] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>File Browser</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateUp(-1)}
            className="h-8 px-2"
          >
            <Home className="h-4 w-4" />
          </Button>
          
          {pathParts.map((part, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateUp(index)}
                className="h-8 px-2"
              >
                {part}
              </Button>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Folders */}
              {folders.filter((folder) => folder.name).map((folder) => (
                <TableRow
                  key={folder.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigateToFolder(folder.name)}
                >
                  <TableCell>
                    <Folder className="h-5 w-5 text-blue-500" />
                  </TableCell>
                  <TableCell className="font-medium">{folder.name?.split('/').filter(Boolean).pop() || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Folder</Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}

              {/* Files */}
              {files.filter((file: any) => file.fileName).map((file: any) => (
                <TableRow key={file.fileId || file.fileName}>
                  <TableCell>
                    <File className="h-5 w-5 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">
                    {file.fileName?.split('/').pop() || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {file.contentType?.split('/').pop()?.toUpperCase() || 'FILE'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatFileSize(file.contentLength)}</TableCell>
                  <TableCell>
                    {file.metadata?.entity_type && (
                      <Badge variant="outline">{file.metadata.entity_type}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ViewButton fileName={file.fileName} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(file.fileName, file.fileId)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {folders.length === 0 && files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No files or folders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file from Backblaze B2. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

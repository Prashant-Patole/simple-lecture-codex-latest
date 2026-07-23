import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  useAdminRecordings, 
  useRecordingStats, 
  useDeleteRecording, 
  useReprocessRecording,
  useBulkDeleteRecordings 
} from '@/hooks/useAdminRecordings';
import { useAdminCourses } from '@/hooks/useAdminCourses';
import { useAllSubjects } from '@/hooks/useAllSubjects';
import { RecordingUploadDialog } from '@/components/admin/RecordingUploadDialog';
import { RecordingEditDialog } from '@/components/admin/RecordingEditDialog';
import { RecordingPreviewDialog } from '@/components/admin/RecordingPreviewDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Video, 
  Search, 
  Trash2, 
  RefreshCw, 
  Clock, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Play,
  Upload,
  Edit,
  Calendar as CalendarIcon,
  Download,
  FileDown
} from 'lucide-react';

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '-';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const StatusBadge = ({ status }: { status: string | null }) => {
  switch (status) {
    case 'ready':
      return <Badge className="bg-green-500/20 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>;
    case 'processing':
      return <Badge className="bg-blue-500/20 text-blue-700"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500/20 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-500/20 text-red-700"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    default:
      return <Badge variant="outline">{status || 'Unknown'}</Badge>;
  }
};

export default function RecordingsManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);

  const { data: recordings, isLoading } = useAdminRecordings({
    courseId: courseFilter !== 'all' ? courseFilter : undefined,
    subjectId: subjectFilter !== 'all' ? subjectFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    dateFrom: dateFrom?.toISOString(),
    dateTo: dateTo?.toISOString(),
  });
  const { data: stats, isLoading: statsLoading } = useRecordingStats();
  const { data: courses } = useAdminCourses();
  const { data: subjects } = useAllSubjects();
  
  const deleteRecording = useDeleteRecording();
  const reprocessRecording = useReprocessRecording();
  const bulkDelete = useBulkDeleteRecordings();

  const filteredRecordings = recordings?.filter(r => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    // Support both topic-based and class-based recordings
    const title = (r as any).recording_title || '';
    const subjectName = (r as any).subject?.name || r.scheduled_class?.subject || '';
    const courseName = (r as any).course?.name || r.scheduled_class?.course?.name || '';
    const teacherName = r.scheduled_class?.teacher?.full_name || '';
    const topicTitle = (r as any).topic?.title || '';
    const chapterTitle = (r as any).chapter?.title || '';
    return (
      title.toLowerCase().includes(search) ||
      subjectName.toLowerCase().includes(search) ||
      courseName.toLowerCase().includes(search) ||
      teacherName.toLowerCase().includes(search) ||
      topicTitle.toLowerCase().includes(search) ||
      chapterTitle.toLowerCase().includes(search)
    );
  }) || [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRecordings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecordings.map(r => r.id));
    }
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(selectedIds, {
      onSuccess: () => setSelectedIds([])
    });
  };

  const handlePreview = (recording: any) => {
    setSelectedRecording(recording);
    setPreviewDialogOpen(true);
  };

  const handleEdit = (recording: any) => {
    setSelectedRecording(recording);
    setEditDialogOpen(true);
  };

  const exportToCsv = () => {
    if (!filteredRecordings.length) return;

    const headers = ['Title', 'Subject', 'Course', 'Type', 'Date', 'Duration', 'Status', 'Qualities'];
    const rows = filteredRecordings.map(r => [
      (r as any).recording_title || r.scheduled_class?.teacher?.full_name || '',
      (r as any).subject?.name || r.scheduled_class?.subject || '',
      (r as any).course?.name || r.scheduled_class?.course?.name || '',
      (r as any).recording_type || 'class',
      r.scheduled_class?.scheduled_at 
        ? format(new Date(r.scheduled_class.scheduled_at), 'yyyy-MM-dd') 
        : r.created_at 
          ? format(new Date(r.created_at), 'yyyy-MM-dd')
          : '',
      formatDuration(r.duration_seconds),
      r.processing_status || '',
      r.available_qualities?.join(', ') || '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recordings-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCourseFilter('all');
    setSubjectFilter('all');
    setStatusFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchQuery || courseFilter !== 'all' || subjectFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Class Recordings Manager</h1>
          <p className="text-muted-foreground">Manage and monitor all class recordings</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Recording
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.total}</p>
                <p className="text-xs text-muted-foreground">Total Recordings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.ready}</p>
                <p className="text-xs text-muted-foreground">Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : formatDuration(stats?.totalDuration || 0)}</p>
                <p className="text-xs text-muted-foreground">Total Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <HardDrive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : formatFileSize(stats?.totalSize || 0)}</p>
                <p className="text-xs text-muted-foreground">Storage Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Row 1: Search and Dropdowns */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recordings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map(course => (
                  <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects?.map(subject => (
                  <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Date Range */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              Date Range:
            </span>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(dateFrom && 'bg-primary/10')}>
                  {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">-</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(dateTo && 'bg-primary/10')}>
                  {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="flex-1" />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={exportToCsv} disabled={!filteredRecordings.length}>
              <FileDown className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedIds.length} recording(s) selected</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const failedIds = filteredRecordings
                      .filter(r => selectedIds.includes(r.id) && r.processing_status === 'failed')
                      .map(r => r.id);
                    failedIds.forEach(id => reprocessRecording.mutate(id));
                  }}
                  disabled={reprocessRecording.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry Failed
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedIds.length} recordings?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the selected recordings. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recordings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Recordings ({filteredRecordings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recordings found</p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.length === filteredRecordings.length && filteredRecordings.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Qualities</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecordings.map((recording) => (
                  <TableRow key={recording.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(recording.id)}
                        onCheckedChange={() => toggleSelect(recording.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {(recording as any).recording_title || 
                         recording.scheduled_class?.teacher?.full_name || 
                         'Unknown'}
                      </div>
                      {(recording as any).topic?.title && (
                        <div className="text-xs text-muted-foreground">
                          Topic: {(recording as any).topic.title}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(recording as any).subject?.name || 
                       recording.scheduled_class?.subject || 
                       '-'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {(recording as any).course?.name || 
                         recording.scheduled_class?.course?.name || 
                         '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(recording as any).recording_type === 'topic' ? 'Topic' : 'Class'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {recording.scheduled_class?.scheduled_at 
                        ? format(new Date(recording.scheduled_class.scheduled_at), 'MMM d, yyyy')
                        : recording.created_at
                          ? format(new Date(recording.created_at), 'MMM d, yyyy')
                          : '-'}
                    </TableCell>
                    <TableCell>{formatDuration(recording.duration_seconds)}</TableCell>
                    <TableCell>
                      <StatusBadge status={recording.processing_status} />
                      {recording.processing_error && (
                        <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={recording.processing_error}>
                          {recording.processing_error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {recording.available_qualities?.map((q: string) => (
                          <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
                        )) || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {recording.processing_status === 'ready' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Preview"
                            onClick={() => handlePreview(recording)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Edit"
                          onClick={() => handleEdit(recording)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {recording.processing_status === 'failed' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Retry Processing"
                            onClick={() => reprocessRecording.mutate(recording.id)}
                            disabled={reprocessRecording.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete recording?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this recording. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteRecording.mutate(recording.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RecordingUploadDialog 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen} 
      />
      <RecordingEditDialog 
        recording={selectedRecording} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
      <RecordingPreviewDialog 
        recording={selectedRecording} 
        open={previewDialogOpen} 
        onOpenChange={setPreviewDialogOpen} 
      />
    </div>
  );
}

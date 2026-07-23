import { useState, useMemo } from 'react';
import { useAdminOrders, OrderItem } from '@/hooks/useAdminOrders';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';
import { formatINR } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { Search, Eye, Package, CreditCard, CalendarIcon, X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const PAGE_SIZE = 25;
const SSLC_COURSE_ID = '4c10bc8e-acbc-4b76-b7f5-54376c030cb0';

const OrdersList = () => {
  const { data: orders, isLoading } = useAdminOrders();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBinding, setIsBinding] = useState(false);

  // Compute pending-not-enrolled orders
  const pendingNotEnrolled = useMemo(() => {
    if (!orders) return [];
    // Get user IDs with successful payments
    const successUserIds = new Set(
      orders.filter(o => o.status === 'success').map(o => o.user_id)
    );
    // Get pending orders for users who have NO successful payment
    const pendingOrders = orders.filter(
      o => o.status === 'pending' && !successUserIds.has(o.user_id)
    );
    // Deduplicate by user_id, keeping the latest
    const byUser = new Map<string, OrderItem>();
    pendingOrders.forEach(o => {
      if (!byUser.has(o.user_id) || new Date(o.created_at) > new Date(byUser.get(o.user_id)!.created_at)) {
        byUser.set(o.user_id, o);
      }
    });
    return Array.from(byUser.values());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = showPendingOnly ? pendingNotEnrolled : (orders || []);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.order_id?.toLowerCase().includes(query) ||
        order.student_name?.toLowerCase().includes(query) ||
        order.student_email?.toLowerCase().includes(query) ||
        order.courses.some(c => c.name.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'all' && !showPendingOnly) {
      result = result.filter(order => order.status === statusFilter);
    }

    if (dateFilter) {
      result = result.filter(order => isSameDay(new Date(order.created_at), dateFilter));
    }

    return result;
  }, [orders, searchQuery, statusFilter, dateFilter, showPendingOnly, pendingNotEnrolled]);

  const totalPages = Math.ceil((filteredOrders?.length || 0) / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFilter(undefined);
    setCurrentPage(1);
    setShowPendingOnly(false);
    setSelectedUserIds(new Set());
  };

  const handleFilterChange = (setter: Function) => (value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const toggleSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === paginatedOrders.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(paginatedOrders.map(o => o.user_id)));
    }
  };

  const handleBindToSSLC = async () => {
    if (selectedUserIds.size === 0) return;
    setIsBinding(true);
    try {
      const userIds = Array.from(selectedUserIds);

      // Insert enrollments
      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert(userIds.map(uid => ({
          student_id: uid,
          course_id: SSLC_COURSE_ID,
          is_active: true,
        })));
      if (enrollError) throw enrollError;

      // Update payment status to success for these users' pending payments
      const { error: payError } = await supabase
        .from('payments')
        .update({ status: 'success', completed_at: new Date().toISOString() })
        .in('user_id', userIds)
        .eq('status', 'pending');
      if (payError) throw payError;

      toast.success(`Successfully enrolled ${userIds.length} user(s) to SSLC Karnataka`);
      setSelectedUserIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (err: any) {
      toast.error('Failed to bind: ' + (err.message || 'Unknown error'));
    } finally {
      setIsBinding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Success</Badge>;
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">View and manage all student enrollments and orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <span className="text-lg font-semibold">
            {filteredOrders.length !== (orders?.length || 0)
              ? `${filteredOrders.length} / ${orders?.length || 0} Orders`
              : `${orders?.length || 0} Orders`}
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID, student name, email, or course..."
            value={searchQuery}
            onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)} disabled={showPendingOnly}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter ? format(dateFilter, 'PPP') : <span>Filter by date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={handleFilterChange(setDateFilter)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant={showPendingOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowPendingOnly(!showPendingOnly);
              setCurrentPage(1);
              setSelectedUserIds(new Set());
            }}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Pending (Not Enrolled) ({pendingNotEnrolled.length})
          </Button>

          {(searchQuery || statusFilter !== 'all' || dateFilter || showPendingOnly) && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="h-4 w-4 mr-1" /> Reset
            </Button>
          )}
        </div>
      </Card>

      {/* Bind Action Bar */}
      {showPendingOnly && selectedUserIds.size > 0 && (
        <Card className="p-3 flex items-center justify-between bg-accent/50">
          <span className="text-sm font-medium">{selectedUserIds.size} user(s) selected</span>
          <Button size="sm" onClick={handleBindToSSLC} disabled={isBinding}>
            <UserPlus className="h-4 w-4 mr-1" />
            {isBinding ? 'Binding...' : 'Bind Selected to SSLC Karnataka'}
          </Button>
        </Card>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {showPendingOnly && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedOrders.length > 0 && selectedUserIds.size === paginatedOrders.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Order ID</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Courses</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showPendingOnly ? 8 : 7} className="text-center py-8 text-muted-foreground">No orders found</TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow key={order.id}>
                  {showPendingOnly && (
                    <TableCell>
                      <Checkbox
                        checked={selectedUserIds.has(order.user_id)}
                        onCheckedChange={() => toggleSelection(order.user_id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{order.order_id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.student_name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{order.student_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {order.courses.slice(0, 2).map((course, idx) => (
                        <div key={idx} className="text-sm">{course.name}</div>
                      ))}
                      {order.courses.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{order.courses.length - 2} more</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{formatINR(order.final_amount)}</div>
                      {order.discount_amount && order.discount_amount > 0 && (
                        <div className="text-xs text-green-600">-{formatINR(order.discount_amount)} discount</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Order Details
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Order ID</p><p className="font-mono font-semibold">{selectedOrder.order_id}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p>{getStatusBadge(selectedOrder.status)}</div>
                <div><p className="text-sm text-muted-foreground">Payment Date</p><p>{format(new Date(selectedOrder.created_at), 'dd MMM yyyy, hh:mm a')}</p></div>
                <div><p className="text-sm text-muted-foreground">Payment Gateway</p><p className="capitalize">{selectedOrder.payment_gateway || 'N/A'}</p></div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Student Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">Name</p><p>{selectedOrder.student_name || 'N/A'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Email</p><p>{selectedOrder.student_email || 'N/A'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Phone</p><p>{selectedOrder.student_phone || 'N/A'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Location</p><p>{[selectedOrder.metadata?.customerInfo?.city, selectedOrder.metadata?.customerInfo?.state].filter(Boolean).join(', ') || 'N/A'}</p></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Courses Purchased</h4>
                <div className="space-y-2">
                  {selectedOrder.courses.map((course, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span>{course.name}</span>
                      <span className="font-semibold">{formatINR(course.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Payment Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(selectedOrder.amount_inr)}</span></div>
                  {selectedOrder.discount_amount && selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount {selectedOrder.metadata?.promoCode && `(${selectedOrder.metadata.promoCode})`}</span>
                      <span>-{formatINR(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total Paid</span><span>{formatINR(selectedOrder.final_amount)}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersList;

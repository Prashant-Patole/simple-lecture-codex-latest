import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePromoCodes, useDeletePromoCode } from "@/hooks/usePromoCodes";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

const PromoCodesList = () => {
  const { data: promoCodes, isLoading } = usePromoCodes();
  const deletePromoCode = useDeletePromoCode();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPromoCodes = promoCodes?.filter((promo) =>
    promo.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    promo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatus = (promo: any) => {
    if (!promo.is_active) return { label: 'Inactive', variant: 'secondary' as const };
    
    const now = new Date();
    const validUntil = promo.valid_until ? new Date(promo.valid_until) : null;
    
    if (validUntil && now > validUntil) return { label: 'Expired', variant: 'destructive' as const };
    if (promo.max_uses && promo.times_used >= promo.max_uses) return { label: 'Limit Reached', variant: 'destructive' as const };
    
    return { label: 'Active', variant: 'default' as const };
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Promo Codes</h1>
          <p className="text-muted-foreground">Manage discount and promotional codes</p>
        </div>
        <Button asChild>
          <Link to="/admin/promo-codes/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Promo Code
          </Link>
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search promo codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading promo codes...</div>
        ) : filteredPromoCodes && filteredPromoCodes.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromoCodes.map((promo) => {
                  const status = getStatus(promo);
                  return (
                    <TableRow key={promo.id}>
                      <TableCell className="font-mono font-bold">{promo.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{promo.description || '-'}</TableCell>
                      <TableCell>
                        {promo.discount_percent ? (
                          <span className="font-semibold text-green-600">{promo.discount_percent}% OFF</span>
                        ) : promo.discount_amount ? (
                          <span className="font-semibold text-green-600">₹{promo.discount_amount} OFF</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {promo.valid_until ? (
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(promo.valid_until), { addSuffix: true })}
                          </span>
                        ) : 'No limit'}
                      </TableCell>
                      <TableCell>
                        {promo.times_used || 0} 
                        {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/admin/promo-codes/edit/${promo.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Promo Code</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the promo code "{promo.code}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePromoCode.mutate(promo.id)}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">No promo codes found</p>
            <p className="text-sm">Create your first promo code to get started</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PromoCodesList;

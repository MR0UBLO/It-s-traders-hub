import { 
  useGetAdminStats, 
  useGetAdminUsers, 
  useGetAdminDeposits, 
  useGetAdminTrades,
  useAdjustBalance,
  getGetAdminUsersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Users, CreditCard, Activity, DollarSign } from "lucide-react";

export default function Admin() {
  const { data: stats } = useGetAdminStats();
  const { data: users } = useGetAdminUsers();
  const { data: deposits } = useGetAdminDeposits();
  const { data: trades } = useGetAdminTrades();
  
  const adjustBalance = useAdjustBalance();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState("");
  const [reason, setReason] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    
    const balance = Number(newBalance);
    if (isNaN(balance)) return;

    adjustBalance.mutate({ id: selectedUserId, data: { balance, reason } }, {
      onSuccess: () => {
        toast({ title: "Balance updated" });
        setIsDialogOpen(false);
        setNewBalance("");
        setReason("");
        queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-8 w-8" /> System Administration
        </h1>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">{stats.activeTraders} active traders</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.totalDeposits.toLocaleString()} KES</div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trading Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.totalVolume.toLocaleString()} KES</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Total Profit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-muted-foreground">{user.id}</TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-right font-mono">{user.balance.toLocaleString()} KES</TableCell>
                      <TableCell className={`text-right font-mono ${user.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {user.totalProfit >= 0 ? '+' : ''}{user.totalProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog open={isDialogOpen && selectedUserId === user.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) {
                            setSelectedUserId(user.id);
                            setNewBalance(user.balance.toString());
                          } else {
                            setSelectedUserId(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">Adjust</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Adjust Balance for {user.name}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAdjustBalance} className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <Label>New Balance (KES)</Label>
                                <Input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Reason (Optional)</Label>
                                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Refund" />
                              </div>
                              <Button type="submit" className="w-full" disabled={adjustBalance.isPending}>
                                {adjustBalance.isPending ? "Updating..." : "Update Balance"}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits?.map(dep => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-medium">{dep.userName || `User #${dep.userId}`}</TableCell>
                      <TableCell className="font-mono">{dep.amount.toLocaleString()} KES</TableCell>
                      <TableCell>
                        <span className={`uppercase text-xs font-bold px-2 py-1 rounded-sm ${
                          dep.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                          dep.status === 'failed' ? 'bg-red-500/10 text-red-500' : 
                          'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {dep.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{dep.mpesaReceiptNumber || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(dep.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Global Trade History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades?.map(trade => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">{trade.userName || `User #${trade.userId}`}</TableCell>
                      <TableCell>{trade.symbol}</TableCell>
                      <TableCell>
                        <span className={`uppercase font-bold text-xs ${trade.direction === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.direction}
                        </span>
                      </TableCell>
                      <TableCell>{trade.amount.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">
                        {trade.profitLoss != null ? (
                          <span className={trade.profitLoss >= 0 ? "text-green-500" : "text-red-500"}>
                            {trade.profitLoss >= 0 ? "+" : ""}{trade.profitLoss.toLocaleString()}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{trade.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
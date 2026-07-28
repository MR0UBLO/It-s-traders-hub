import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal } from "lucide-react";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-8 w-8 text-primary" /> Leaderboard
        </h1>
        <p className="text-muted-foreground">Top performing traders on the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Rankings</CardTitle>
          <CardDescription>Ranked by total profit</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Rank</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead className="text-right">Total Profit</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading rankings...</TableCell>
                </TableRow>
              ) : leaderboard && leaderboard.length > 0 ? (
                leaderboard.map((entry, idx) => (
                  <TableRow key={entry.userId}>
                    <TableCell>
                      {idx + 1 <= 3 ? (
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold">
                          {idx + 1}
                        </div>
                      ) : (
                        <span className="font-mono text-muted-foreground pl-2">{idx + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-lg">{entry.name}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-500">
                      +{entry.totalProfit.toLocaleString()} KES
                    </TableCell>
                    <TableCell className="text-right font-mono">{entry.winRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{entry.totalTrades}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data available yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
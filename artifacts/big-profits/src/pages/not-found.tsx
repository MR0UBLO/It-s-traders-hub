import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-6 px-4">
      <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
        <TrendingUp className="w-6 h-6 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This page doesn't exist. Head back to the dashboard.
        </p>
      </div>
      <Link href="/dashboard">
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Back to Dashboard</Button>
      </Link>
    </div>
  );
}

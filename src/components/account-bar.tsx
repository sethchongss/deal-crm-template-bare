"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountBar() {
  return (
    <form action="/api/auth/logout" method="post">
      <Button type="submit" variant="ghost" size="sm" className="h-9 text-xs">
        <LogOut className="h-3.5 w-3.5 mr-1" />
        Sign out
      </Button>
    </form>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SidebarNav } from "./nav-links";

/**
 * Small-screen navigation: a left drawer built on the Dialog primitive
 * (focus trap, Escape to close, scroll lock). `header` carries server-rendered
 * parts such as the logo and workspace switcher.
 */
export function MobileNav({ header }: { header: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <MenuIcon />
          </Button>
        }
      />
      <DialogContent
        className="top-0 left-0 flex h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-4 overflow-y-auto rounded-none bg-sidebar p-3 text-sidebar-foreground sm:max-w-72 data-open:slide-in-from-left data-closed:slide-out-to-left"
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        {header}
        <SidebarNav onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}


"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet" 
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3.5rem"; 
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean | null;
  toggleSidebar: () => void;
  hasMounted: boolean; 
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
  }
>(
  (
    {
      defaultOpen = true,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobileHookValue = useIsMobile();
    const [open, setOpen] = React.useState(defaultOpen);
    const [openMobile, setOpenMobile] = React.useState(false);
    const [hasMounted, setHasMounted] = React.useState(false);

    React.useEffect(() => {
      setHasMounted(true); 
    }, []);

    const toggleSidebar = React.useCallback(() => {
      if (isMobileHookValue) {
        setOpenMobile((current) => !current);
      } else if (isMobileHookValue === false) {
        setOpen((current) => !current);
      }
    }, [isMobileHookValue, setOpen, setOpenMobile]);

    React.useEffect(() => {
      if (!hasMounted) return; 
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar, hasMounted]);
    
    const desktopState = open ? "expanded" : "collapsed"; 

    const contextValue = React.useMemo<SidebarContextValue>(
      () => ({
        state: desktopState,
        open,
        setOpen,
        isMobile: isMobileHookValue,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        hasMounted, 
      }),
      [desktopState, open, setOpen, isMobileHookValue, openMobile, setOpenMobile, toggleSidebar, hasMounted]
    );
    
    React.useEffect(() => {
      if (!hasMounted) return; 
      const wrapper = document.querySelector('.group\\/sidebar-provider');
      if (wrapper) {
        if (isMobileHookValue) {
          wrapper.classList.add('is-mobile');
          wrapper.removeAttribute('data-sidebar-collapsed');
        } else {
          wrapper.classList.remove('is-mobile');
          if (!open) {
            wrapper.setAttribute('data-sidebar-collapsed', 'true');
          } else {
            wrapper.removeAttribute('data-sidebar-collapsed');
          }
        }
      }
    }, [isMobileHookValue, open, hasMounted]);


    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-provider flex min-h-svh w-full",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  }
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"aside"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "icon",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, open, state, openMobile, setOpenMobile, hasMounted } = useSidebar();

    if (!hasMounted) {
      // Render null on the server and for the initial client render.
      // This ensures no mismatch for the <aside> tag itself.
      // The AppSidebar component in layout.tsx will still be rendered,
      // but this specific Sidebar rendering its complex structure will wait for mount.
      // If this causes layout shift, a simple static placeholder could be used instead of null.
      // For example, a div with a fixed width matching the collapsed sidebar.
      // However, for fixed/floating sidebars, `null` is often the safest first step.
      // For 'inset' variant, we might need to render a placeholder to occupy space.
      if (variant === 'inset') {
          const initialOpenState = useSidebar().open; // This will be defaultOpen on server
          const initialInsetClasses = cn(
              "h-full flex-col bg-sidebar text-sidebar-foreground",
              initialOpenState ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
              className
          );
           return (
             <aside ref={ref} className={initialInsetClasses} data-variant={variant} data-state={initialOpenState ? "expanded" : "collapsed"}>
                {/* Minimal skeleton for children if necessary */}
             </aside>
           );
      }
      return null; 
    }

    // Client-side rendering (hasMounted is true)
    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent
            side={side}
            className="w-[var(--sidebar-width-mobile)] bg-sidebar text-sidebar-foreground flex flex-col p-0"
          >
            {children}
          </SheetContent>
        </Sheet>
      );
    }

    // Desktop rendering (hasMounted is true, isMobile is false)
    const desktopSidebarClasses = cn(
      "fixed inset-y-0 z-20 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border transition-all duration-300 ease-in-out",
      side === "left" ? "border-r" : "border-l",
      state === "expanded" ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
      collapsible === "offcanvas" && state === "collapsed" ? (side === "left" ? "-translate-x-full" : "translate-x-full") : "translate-x-0",
      variant === "floating" && "shadow-lg m-2 rounded-lg h-[calc(100vh-1rem)]",
      // variant === "inset" is handled separately if it's the primary mode
      className
    );
    
    if (variant === 'inset') { 
       return (
         <aside
            ref={ref}
            className={cn(
                "h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
                 state === "expanded" ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
                 className
            )}
            data-state={state}
            data-collapsible-type={collapsible}
            data-variant={variant}
            {...props}
         >
           {children}
         </aside>
       );
    }

    return (
      <aside
        ref={ref}
        data-state={state}
        data-collapsible-type={collapsible}
        data-variant={variant}
        className={desktopSidebarClasses}
        {...props}
      >
        {children}
      </aside>
    );
  }
);
Sidebar.displayName = "Sidebar";


const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, isMobile, openMobile, state, hasMounted } = useSidebar();

  if (!hasMounted) { 
    return <Button variant="ghost" size="icon" className={cn("h-8 w-8 opacity-0 pointer-events-none", className)}><PanelLeft /></Button>; // Render a placeholder
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      aria-expanded={isMobile ? openMobile : state === 'expanded'}
      aria-controls={isMobile ? undefined : "app-sidebar-content"} // Assuming app-sidebar-content is an ID for the sidebar's main content area
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile) return null;

  return (
    <button
      ref={ref}
      aria-label="Toggle Sidebar"
      title="Toggle Sidebar"
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 z-30 hidden w-4 cursor-pointer items-center justify-center group-data-[sidebar-variant=floating]/sidebar-provider:hidden",
        "group-data-[sidebar-side=left]/sidebar-provider:right-0 group-data-[sidebar-side=left]/sidebar-provider:translate-x-1/2",
        "group-data-[sidebar-side=right]/sidebar-provider:left-0 group-data-[sidebar-side=right]/sidebar-provider:-translate-x-1/2",
        "md:flex",
        "hover:bg-sidebar-accent/20 transition-colors",
        className
      )}
      {...props}
    />
  );
});
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "flex-1 flex flex-col overflow-auto",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
});
SidebarInset.displayName = "SidebarInset";

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return <Skeleton className={cn("h-8 w-full my-1 mx-2", state === 'collapsed' && "hidden", className)} />; 

  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  );
});
SidebarInput.displayName = "SidebarInput";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col shrink-0", className)}
      {...props}
    />
  );
});
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col shrink-0", className)}
      {...props}
    />
  );
});
SidebarFooter.displayName = "SidebarFooter";

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 my-1 w-auto bg-sidebar-border", className)}
      {...props}
    />
  );
});
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2",
        className
      )}
      {...props}
    />
  );
});
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  );
});
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div";
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return null;

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring focus-visible:ring-2",
        className
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return null;

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        className
      )}
      {...props}
    />
  );
});
SidebarGroupAction.displayName = "SidebarGroupAction";

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left transition-colors duration-150 ease-in-out text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground",
  {
    variants: {
      variant: {
        default: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-transparent border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      size: {
        default: "h-10 text-sm",
        sm: "h-8 text-xs",
        lg: "h-12 text-sm",
      },
      justify: {
        start: "justify-start",
        center: "justify-center",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      justify: "start",
    },
  }
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const { isMobile, open: contextOpen, state: sidebarContextState, hasMounted } = useSidebar();

    if (!hasMounted) {
       // If used as a child (e.g., with Link), render its children but hide them to preserve structure.
      if (asChild) {
        return <Comp className={cn(className, "opacity-0 pointer-events-none")}>{children}</Comp>;
      }
      // Otherwise, render a skeleton.
      const isLikelyCollapsedServer = !contextOpen; 
      return (
        <Skeleton
          className={cn(
            sidebarMenuButtonVariants({ size, justify: isLikelyCollapsedServer ? 'center' : 'start'}),
            isLikelyCollapsedServer && 'px-0 w-[var(--sidebar-width-icon)] h-[var(--sidebar-width-icon)]',
            className
          )}
        />
      );
    }
    
    const effectiveState = isMobile ? "expanded" : sidebarContextState;
    const renderAsCollapsedIconDesktop = effectiveState === "collapsed" && !isMobile;

    const buttonClasses = cn(
      sidebarMenuButtonVariants({
        variant,
        size,
        justify: renderAsCollapsedIconDesktop ? 'center' : 'start',
      }),
      renderAsCollapsedIconDesktop && 'px-0 w-[var(--sidebar-width-icon)] h-[var(--sidebar-width-icon)]',
      className
    );

    const dataAttributes = {
      'data-sidebar': "menu-button",
      'data-size': size,
      'data-active': isActive,
    };

    const elementProps = {
      ref,
      className: buttonClasses,
      ...dataAttributes,
      ...props,
    };

    const buttonElement = asChild ? (
      <Comp {...elementProps}>{children}</Comp>
    ) : (
      <button type="button" {...elementProps}>{children}</button>
    );
    
    if (tooltip && !isMobile && effectiveState === "collapsed") {
      const tooltipProps = typeof tooltip === 'string' ? { children: tooltip } : tooltip;
      return (
        <Tooltip>
          <TooltipTrigger asChild>{buttonElement}</TooltipTrigger>
          <TooltipContent side="right" align="center" alignOffset={4} sideOffset={8} {...tooltipProps} />
        </Tooltip>
      );
    }

    return buttonElement;
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    showOnHover?: boolean;
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return null;


  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1/2 -translate-y-1/2 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  );
});
SidebarMenuAction.displayName = "SidebarMenuAction";

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return null;

  return (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[0.625rem] font-semibold tabular-nums text-sidebar-primary-foreground select-none pointer-events-none",
      className
    )}
    {...props}
  />
)});
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean;
  }
>(({ className, showIcon = true, ...props }, ref) => {
  const { state: sidebarState, isMobile, hasMounted, open: sidebarOpen  } = useSidebar(); 
  
  if (!hasMounted) {
      const isLikelyCollapsedInitial = !sidebarOpen; 
      const width = React.useMemo(() => {
        return `${Math.floor(Math.random() * 40) + 50}%`;
      }, []);
      return (
        <div
          ref={ref}
          data-sidebar="menu-skeleton"
          className={cn("rounded-md h-10 flex gap-2 px-2 items-center", isLikelyCollapsedInitial && "justify-center", className)}
          {...props}
        >
          {showIcon && (
            <Skeleton
              className="size-5 rounded-md shrink-0"
              data-sidebar="menu-skeleton-icon"
            />
          )}
          {!isLikelyCollapsedInitial && ( 
            <Skeleton
                className="h-4 flex-1 max-w-[--skeleton-width]"
                data-sidebar="menu-skeleton-text"
                style={{ "--skeleton-width": width } as React.CSSProperties}
            />
          )}
        </div>
      );
  }

  if (isMobile || (sidebarState === "collapsed" && !isMobile)) {
    return (
        <div
          ref={ref}
          data-sidebar="menu-skeleton"
          className={cn("rounded-md h-10 flex gap-2 px-2 items-center justify-center", className)}
          {...props}
        >
          {showIcon && (
            <Skeleton
              className="size-5 rounded-md shrink-0"
              data-sidebar="menu-skeleton-icon"
            />
          )}
        </div>
    );
  }

  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("rounded-md h-10 flex gap-2 px-2 items-center", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-5 rounded-md shrink-0"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
          className="h-4 flex-1 max-w-[--skeleton-width]"
          data-sidebar="menu-skeleton-text"
          style={{ "--skeleton-width": width } as React.CSSProperties}
      />
    </div>
  );
});
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return null;

  return (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "ml-5 flex min-w-0 translate-x-px flex-col gap-0.5 border-l border-sidebar-border pl-3 py-1",
      className
    )}
    {...props}
  />
)});
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} className="relative" {...props} />);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean;
    size?: "sm" | "default";
    isActive?: boolean;
  }
>(({ asChild = false, size = "default", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";
  const { state, isMobile, hasMounted } = useSidebar();

  if (!hasMounted || isMobile || state === 'collapsed') return null;

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sidebar-foreground/80 outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium",
        size === "sm" && "text-xs h-7",
        size === "default" && "text-sm h-8",
        className
      )}
      {...props}
    />
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};


    
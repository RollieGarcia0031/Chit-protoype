
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
const SIDEBAR_WIDTH_ICON = "3.5rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean | null;
  toggleSidebar: () => void;
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

    const toggleSidebar = React.useCallback(() => {
      if (isMobileHookValue) {
        setOpenMobile((current) => !current);
      } else if (isMobileHookValue === false) {
        setOpen((current) => !current);
      }
    }, [isMobileHookValue, setOpen, setOpenMobile]);

    React.useEffect(() => {
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
    }, [isMobileHookValue, open]);

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
      }),
      [desktopState, open, setOpen, isMobileHookValue, openMobile, setOpenMobile, toggleSidebar]
    );

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
    const { isMobile, open, state, openMobile, setOpenMobile } = useSidebar();

    // SSR and initial client render: Render a basic desktop structure to match client's first paint expectation
    if (isMobile === null) {
      const serverState = open ? "expanded" : "collapsed"; // 'open' is 'defaultOpen' on server
      const initialClasses = cn(
        "fixed inset-y-0 z-20 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border",
        side === "left" ? "border-r" : "border-l",
        serverState === "expanded" ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
        collapsible === "offcanvas" && serverState === "collapsed" ? (side === "left" ? "-translate-x-full" : "translate-x-full") : "translate-x-0",
        variant === "floating" && "shadow-lg m-2 rounded-lg h-[calc(100vh-1rem)]",
        className
      );
      return (
        <aside 
          ref={ref} 
          className={initialClasses} 
          data-state={serverState} // Use state derived from defaultOpen
          data-collapsible-type={collapsible}
          data-variant={variant}
          {...props}
        >
          {children}
        </aside>
      );
    }

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

    // Client-side desktop rendering
    const desktopSidebarClasses = cn(
      "fixed inset-y-0 z-20 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border transition-all duration-300 ease-in-out",
      side === "left" ? "border-r" : "border-l",
      state === "expanded" ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
      collapsible === "offcanvas" && state === "collapsed" ? (side === "left" ? "-translate-x-full" : "translate-x-full") : "translate-x-0",
      variant === "floating" && "shadow-lg m-2 rounded-lg h-[calc(100vh-1rem)]",
      className
    );

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
  const { toggleSidebar, isMobile, openMobile, state } = useSidebar();

  if (isMobile === null) { 
    return <Button variant="ghost" size="icon" className={cn("h-8 w-8 opacity-0 pointer-events-none", className)}><PanelLeft /></Button>;
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
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";


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
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left transition-colors duration-150 ease-in-out text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground",
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
    isActive?: boolean; // Prop to indicate if the link is active (from AppSidebar based on pathname)
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false, // Default to false
      variant = "default",
      size = "default",
      tooltip,
      className,
      children,
      onClick: originalOnClick, // Capture original onClick
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const { isMobile, state: sidebarContextState, open: desktopOpen } = useSidebar();
    const [temporarilyActive, setTemporarilyActive] = React.useState(false);

    React.useEffect(() => {
      // If the button is no longer the active page path after navigation,
      // and it was marked as temporarily active from a click,
      // reset the temporary active state.
      if (!isActive && temporarilyActive) {
        setTemporarilyActive(false);
      }
    }, [isActive, temporarilyActive]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      setTemporarilyActive(true);
      originalOnClick?.(event); // Call the original onClick from the Link component or passed prop
    };
    
    const combinedIsActive = isActive || temporarilyActive;

    // Determine effective state for styling (expanded/collapsed)
    const effectiveState = isMobile === null ? (desktopOpen ? "expanded" : "collapsed") : (isMobile ? "expanded" : sidebarContextState);
    const renderAsCollapsedIconDesktop = effectiveState === "collapsed" && (isMobile === null || isMobile === false);


    if (isMobile === null && !asChild) {
      // SSR/initial render for a direct button (not Link): render a skeleton
      const skeletonClasses = cn(
        sidebarMenuButtonVariants({ variant, size, justify: desktopOpen ? "start" : "center" }),
        !desktopOpen && 'px-0 w-[var(--sidebar-width-icon)] h-[var(--sidebar-width-icon)]',
        className
      );
      return <Skeleton className={skeletonClasses} />;
    }
    if (isMobile === null && asChild) {
      // SSR/initial render for asChild (Link): render children but make them invisible/non-interactive
      // to match structure but avoid interaction/style flashes before client hydration
      return <Comp {...props} className={cn(className, "opacity-0 pointer-events-none")}>{children}</Comp>;
    }
    
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
      'data-active': combinedIsActive, // Use combined active state for styling
    };

    const elementProps = {
      ref,
      className: buttonClasses,
      onClick: handleClick,
      ...dataAttributes,
      ...props,
    };

    const buttonElement = asChild ? (
      <Comp {...elementProps}>{children}</Comp>
    ) : (
      <button type="button" {...elementProps}>{children}</button>
    );

    if (tooltip && renderAsCollapsedIconDesktop) {
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

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  const { state, isMobile } = useSidebar();
  if (isMobile === null || isMobile || state === 'collapsed') return null; 

  return (
    <Input
      ref={ref}
      className={cn("h-8 w-full my-1 mx-2", className)}
      {...props}
    />
  );
});
SidebarInput.displayName = "SidebarInput";

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => (
  <Separator ref={ref} className={cn("mx-2 my-1 bg-sidebar-border", className)} {...props} />
));
SidebarSeparator.displayName = "SidebarSeparator";


export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};

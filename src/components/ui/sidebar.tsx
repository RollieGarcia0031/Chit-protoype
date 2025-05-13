
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
import { Sheet, SheetContent, SheetTrigger as RadixSheetTrigger } from "@/components/ui/sheet" // Renamed SheetTrigger to avoid conflict
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem" // Default expanded width
const SIDEBAR_WIDTH_MOBILE = "18rem" // Width for mobile sheet
const SIDEBAR_WIDTH_ICON = "3.5rem" // Default collapsed width (icons only)
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean // Desktop sidebar open state (expanded or collapsed)
  setOpen: (open: boolean) => void
  openMobile: boolean // Mobile sidebar sheet open state
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean // Initial desktop state (true for expanded, false for collapsed)
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    
    const setOpen = React.useCallback(
      (value: boolean | ((currentOpen: boolean) => boolean)) => {
        const newOpenState = typeof value === 'function' ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(newOpenState);
        } else {
          _setOpen(newOpenState);
        }
        // This sets the cookie to keep the sidebar state for desktop.
        if (typeof window !== "undefined") {
            document.cookie = `${SIDEBAR_COOKIE_NAME}=${newOpenState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        }
      },
      [setOpenProp, open]
    );
    

    React.useEffect(() => {
        if (typeof window !== "undefined") {
            const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
            ?.split('=')[1];
            if (cookieValue) {
                const cookieOpenState = cookieValue === 'true';
                if (setOpenProp) {
                    setOpenProp(cookieOpenState);
                } else {
                    _setOpen(cookieOpenState);
                }
            }
        }
    }, [setOpenProp]);


    const toggleSidebar = React.useCallback(() => {
      if (isMobile) {
        setOpenMobile((current) => !current);
      } else {
        setOpen((current) => !current);
      }
    }, [isMobile, setOpen, setOpenMobile]);

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    // Add class to body or a wrapper for easier global styling based on mobile state
    React.useEffect(() => {
      const wrapper = document.querySelector('.group\\/sidebar-provider'); // Target the specific div
      if (wrapper) {
        if (isMobile) {
          wrapper.classList.add('is-mobile');
        } else {
          wrapper.classList.remove('is-mobile');
        }
      }
    }, [isMobile]);


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
              "group/sidebar-provider flex min-h-svh w-full", // Removed has selector for broader compatibility
              // Add data attribute for sidebar state for easier targeting by child layouts
              open ? "" : "data-sidebar-collapsed=true",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

// Main Sidebar component
const Sidebar = React.forwardRef<
  HTMLDivElement, // This is the main aside element
  React.ComponentProps<"aside"> & { // Changed to aside for semantics
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset" // "sidebar" is docked, "floating" overlaps, "inset" is within content area
    collapsible?: "offcanvas" | "icon" | "none" // How it collapses on desktop
  }
>(
  (
    {
      side = "left",
      variant = "sidebar", // Default to standard docked sidebar
      collapsible = "icon", // Default to collapsing to icons
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile, open } = useSidebar()

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <RadixSheetTrigger asChild className="md:hidden">
            {/* This trigger is implicit for mobile; actual button rendered in AppTopBar */}
            <div /> 
          </RadixSheetTrigger>
          <SheetContent
            side={side} // 'left' or 'right'
            className="w-[var(--sidebar-width-mobile)] bg-sidebar p-0 text-sidebar-foreground flex flex-col"
            // Removed [&>button]:hidden as close button should be visible
          >
            {children}
          </SheetContent>
        </Sheet>
      )
    }
    
    // Desktop sidebar rendering
    const desktopSidebarClasses = cn(
      "fixed inset-y-0 z-20 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border transition-all duration-300 ease-in-out",
      side === "left" ? "border-r" : "border-l",
      open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
      collapsible === "offcanvas" && !open ? (side === "left" ? "-translate-x-full" : "translate-x-full") : "translate-x-0",
      variant === "floating" && "shadow-lg m-2 rounded-lg h-[calc(100vh-1rem)]", // Example floating style
      variant === "inset" && "relative", // Inset would be part of normal flow, not fixed
      className
    );

    if (variant === 'inset') {
       // Inset sidebar is part of the document flow, not fixed.
       // Its width control needs to be handled by its container or itself.
       return (
         <aside ref={ref} className={cn("h-full flex-col bg-sidebar text-sidebar-foreground", open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]", className)} {...props}>
           {children}
         </aside>
       );
    }


    return (
      <aside
        ref={ref}
        data-state={state} // 'expanded' or 'collapsed'
        data-collapsible-type={collapsible}
        data-variant={variant}
        className={desktopSidebarClasses}
        {...props}
      >
        {children}
      </aside>
    )
  }
)
Sidebar.displayName = "Sidebar"


// Sidebar Trigger (typically a hamburger icon)
const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, isMobile, openMobile, state } = useSidebar()

  // On mobile, this trigger opens the Sheet.
  // On desktop, this trigger collapses/expands the fixed sidebar.
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      aria-expanded={isMobile ? openMobile : state === 'expanded'}
      aria-controls="app-sidebar-content" // Assuming sidebar content has this ID
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"


// Sidebar Rail (for desktop, if sidebar is collapsible and not off-canvas)
const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar, state, isMobile } = useSidebar()

  if (isMobile) return null; // Rail is for desktop only

  return (
    <button
      ref={ref}
      aria-label="Toggle Sidebar"
      title="Toggle Sidebar"
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 z-30 hidden w-4 cursor-pointer items-center justify-center group-data-[sidebar-variant=floating]/sidebar-provider:hidden", // Hide if floating
        "group-data-[sidebar-side=left]/sidebar-provider:right-0 group-data-[sidebar-side=left]/sidebar-provider:translate-x-1/2",
        "group-data-[sidebar-side=right]/sidebar-provider:left-0 group-data-[sidebar-side=right]/sidebar-provider:-translate-x-1/2",
        "md:flex", 
        // Styling for the rail itself, e.g., a thin hoverable bar
        "hover:bg-sidebar-accent/20 transition-colors",
        className
      )}
      {...props}
    />
  )
})
SidebarRail.displayName = "SidebarRail"


// SidebarInset: The main content area that is affected by the sidebar
// This component is no longer strictly necessary if layout is handled by parent div + sidebar width variable
const SidebarInset = React.forwardRef<
  HTMLElement, // Changed to HTMLElement for flexibility, used as <main>
  React.HTMLAttributes<HTMLElement> // Changed to HTMLAttributes
>(({ className, children, ...props }, ref) => {
  // This component primarily serves as a semantic <main> tag.
  // The actual padding/margin adjustments are handled by the parent div in RootLayout
  // using the CSS variables --sidebar-width and --sidebar-width-icon.
  return (
    <main
      ref={ref}
      className={cn(
        "flex-1 flex flex-col overflow-auto", // Ensure it grows and handles overflow
        className
      )}
      {...props}
    >
      {children}
    </main>
  )
})
SidebarInset.displayName = "SidebarInset"


const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  const { state } = useSidebar();
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        state === 'collapsed' && "sr-only", // Hide when collapsed if desired, or style differently
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col shrink-0", className)} // Removed gap-2 p-2 to be controlled by implementer
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col shrink-0", className)} // Removed gap-2 p-2
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

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
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2", // Added padding here
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"


const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col", className)} // Removed p-2
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"


const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  const { state } = useSidebar();

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        state === 'collapsed' && "sr-only", // Hide label text when collapsed
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"


const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const { state } = useSidebar();

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        state === 'collapsed' && "hidden", // Hide action when collapsed
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

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
))
SidebarGroupContent.displayName = "SidebarGroupContent"

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
))
SidebarMenu.displayName = "SidebarMenu"

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
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-transparent border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      size: {
        default: "h-10 text-sm", // Adjusted height
        sm: "h-8 text-xs",    // Adjusted height
        lg: "h-12 text-sm",   // Adjusted height
      },
      justify: { // New variant for justification when collapsed
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
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
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
      children, // Capture children
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const { isMobile, state } = useSidebar()
    const isCollapsed = !isMobile && state === 'collapsed';

    const buttonContent = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size, justify: isCollapsed ? 'center' : 'start' }), 
                      isCollapsed && 'px-0 w-[var(--sidebar-width-icon)] h-[var(--sidebar-width-icon)]', // Specific style for collapsed icon button
                      className)}
        {...props}
      >
        {children}
      </Comp>
    )

    if (!tooltip || (state === "expanded" && !isMobile) ) { // Don't show tooltip if expanded on desktop
      return buttonContent
    }
    
    const tooltipProps = typeof tooltip === 'string' ? { children: tooltip } : tooltip;


    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          alignOffset={4} // Adjust as needed
          sideOffset={8} // Adjust as needed
          // hidden={state !== "collapsed" || isMobile} // Hide if not collapsed or on mobile - redundant with above logic
          {...tooltipProps}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"


const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const { state } = useSidebar();


  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1/2 -translate-y-1/2 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        // "peer-data-[size=sm]/menu-button:top-1",
        // "peer-data-[size=default]/menu-button:top-1.5",
        // "peer-data-[size=lg]/menu-button:top-2.5",
        state === 'collapsed' && "hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { state } = useSidebar();
  return (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[0.625rem] font-semibold tabular-nums text-sidebar-primary-foreground select-none pointer-events-none",
      // "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      // "peer-data-[size=sm]/menu-button:top-1",
      // "peer-data-[size=default]/menu-button:top-1.5",
      // "peer-data-[size=lg]/menu-button:top-2.5",
      state === 'collapsed' && "hidden",
      className
    )}
    {...props}
  />
)})
SidebarMenuBadge.displayName = "SidebarMenuBadge"

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = true, ...props }, ref) => {
  const { state } = useSidebar();
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("rounded-md h-10 flex gap-2 px-2 items-center", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-5 rounded-md shrink-0" // Adjusted size
          data-sidebar="menu-skeleton-icon"
        />
      )}
      {state === "expanded" && (
        <Skeleton
            className="h-4 flex-1 max-w-[--skeleton-width]"
            data-sidebar="menu-skeleton-text"
            style={
            {
                "--skeleton-width": width,
            } as React.CSSProperties
            }
        />
      )}
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  const { state } = useSidebar();
  return (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "ml-5 flex min-w-0 translate-x-px flex-col gap-0.5 border-l border-sidebar-border pl-3 py-1", // Adjusted spacing
      state === 'collapsed' && "hidden",
      className
    )}
    {...props}
  />
)})
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} className="relative" {...props} />) // Added relative for potential badges/actions
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement, // Assuming it's an anchor, can be button too
  React.ComponentProps<"a"> & { // Or ButtonHTMLAttributes
    asChild?: boolean
    size?: "sm" | "default" // Matched to parent button sizes
    isActive?: boolean
  }
>(({ asChild = false, size = "default", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"
  const { state } = useSidebar();

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sidebar-foreground/80 outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        // Removed [&>svg]:text-sidebar-accent-foreground as it may not always be desired
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium",
        size === "sm" && "text-xs h-7",
        size === "default" && "text-sm h-8",
        state === 'collapsed' && "hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

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
  SidebarInset, // Exporting even if not used for main layout, might be useful for other cases
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
}

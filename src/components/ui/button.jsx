import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "embossed-button text-white",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-amber-400/60 bg-white text-[#145167] shadow-[0_4px_10px_rgba(11,52,68,0.09),inset_0_1px_0_white] hover:-translate-y-0.5 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 hover:shadow-[0_7px_16px_rgba(11,52,68,0.13)]",
        secondary:
          "border border-cyan-200 bg-gradient-to-b from-white to-cyan-50 text-secondary-foreground shadow-[0_4px_10px_rgba(11,52,68,0.08)] hover:-translate-y-0.5 hover:border-amber-400/60 hover:bg-cyan-50",
        ghost: "hover:-translate-y-0.5 hover:bg-cyan-50 hover:text-cyan-800",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }

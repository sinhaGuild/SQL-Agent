import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const typographyVariants = cva(
    "",
    {
        variants: {
            variant: {
                default: "",
                h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
                h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
                h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
                h4: "scroll-m-20 text-xl font-semibold tracking-tight",
                p: "leading-7 [&:not(:first-child)]:mt-6",
                quote: "mt-6 border-l-2 pl-6 italic",
                code: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
                lead: "text-xl text-muted-foreground"
            },
            size: {
                default: "",
                sm: "text-sm font-medium leading-none",
                lg: "text-lg font-semibold",
                muted: "text-sm text-muted-foreground"
            },
            defaultVariants: {
                variant: "default",
                size: "default"
            }
        }
    }
)


export default function Typography({
    className,
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<"p"> & VariantProps<typeof typographyVariants> & { asChild?: boolean }) {

    const Comp = asChild ? Slot : "p"

    return (
        <Comp
            data-slot="p"
            className={cn(typographyVariants({ variant, size, className }))}
            {...props}
        />
    )
}
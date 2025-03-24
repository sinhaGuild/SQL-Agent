"use client"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Info } from "lucide-react"
import { ReactNode } from "react"

interface QuerySegmentProps {
    children: ReactNode
    explanation: string
}

export default function QuerySegmentHover({ children, explanation }: QuerySegmentProps) {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <span className="relative inline-block group">
                    {children}
                    <span className="absolute -top-1 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Info className="size-4 text-blue-500" />
                    </span>
                </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 text-sm">
                <p>{explanation}</p>
            </HoverCardContent>
        </HoverCard>
    )
}

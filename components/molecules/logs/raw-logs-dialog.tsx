"use client"

import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, X } from "lucide-react"
import { useState } from "react"

interface Message {
    type: string
    content: string
    timestamp: Date
}

interface RawLogsDialogProps {
    messages: Message[]
}

export default function RawLogsDialog({ messages }: RawLogsDialogProps) {
    const [open, setOpen] = useState(false)

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Raw Logs
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-[800px] max-h-[80vh]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Detailed Execution Logs</AlertDialogTitle>
                </AlertDialogHeader>
                <ScrollArea className="h-[50vh] mt-4 rounded-md border p-4">
                    {messages.map((message, index) => (
                        <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium px-2 py-1 rounded bg-slate-100">
                                    {message.type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {message.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm bg-slate-50 p-3 rounded-md overflow-x-auto">
                                {message.content}
                            </pre>
                        </div>
                    ))}
                </ScrollArea>
                <AlertDialogFooter className="mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="gap-2"
                    >
                        <X className="h-4 w-4" />
                        Close
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

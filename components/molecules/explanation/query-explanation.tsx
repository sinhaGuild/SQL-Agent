"use client"

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface QueryExplanationProps {
    query: string
    explanation: string
}

export default function QueryExplanation({ query, explanation }: QueryExplanationProps) {
    // Format the explanation for markdown
    const formatExplanationForMarkdown = () => {
        // Check if the explanation already has numbered sections
        if (explanation.match(/\d+\.\s+/)) {
            // If it already has numbered sections, just return it
            return explanation;
        }
        
        // Split the explanation into sections by periods or line breaks
        const sections = explanation
            .split(/(?<=\.)\s+|(?<=\n)/)
            .filter(section => section.trim().length > 0);
        
        // If we have multiple sections, format as a numbered list
        if (sections.length > 1) {
            return "## Breaking Down Each Clause\n\n" + 
                sections.map((section, index) => 
                    `${index + 1}. ${section.trim()}`
                ).join('\n\n');
        }
        
        // If there's just one section, return it as is
        return explanation;
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Show query explanation"
                >
                    <HelpCircle className="size-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="end">
                <div className="bg-blue-50 p-4 rounded-md max-h-[500px] overflow-y-auto">
                    <div className="prose prose-blue max-w-none">
                        <ReactMarkdown>
                            {formatExplanationForMarkdown()}
                        </ReactMarkdown>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

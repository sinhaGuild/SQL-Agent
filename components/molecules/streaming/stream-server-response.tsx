"use client";

import QueryExplanation from "@/components/molecules/explanation/query-explanation";
import SampleQueries from "@/components/molecules/landing/sample-queries";
import RawLogsDialog from "@/components/molecules/logs/raw-logs-dialog";
import DataChart from "@/components/molecules/visualization/data-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { BarChart3, ChevronsDownUp, Loader2, RefreshCw, Table } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown';
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

// Define types for different message types
type MessageType = 'info' | 'tool_response' | 'tool_call' | 'query_generated' | 'query_explanation' | 'final_answer' | 'error' | 'user_query';

interface Message {
    type: MessageType;
    content: string;
    timestamp: Date;
}

// Interface for schema field
interface SchemaField {
    value: string;
    label: string;
}

function StreamingComponent() {
    // State to hold the user's input in the form
    const [queryInput, setQueryInput] = useState<string>("");
    // State to hold the submitted query that triggers fetching
    const [currentQuery, setCurrentQuery] = useState<string | null>(null);
    // State to hold the streamed messages with their types
    const [messages, setMessages] = useState<Message[]>([]);
    // State to track if data is being fetched and progress
    const [isFetching, setIsFetching] = useState(false);
    const [progress, setProgress] = useState(0);
    // Session ID for conversation memory
    const [sessionId, setSessionId] = useState<string>(() => uuidv4());
    // Ref to manage the AbortController across renders
    const abortControllerRef = useRef<AbortController | null>(null);
    // Ref to scroll to bottom of messages
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // State to store the current query result for visualization
    const [queryResult, setQueryResult] = useState<any[] | null>(null);
    // State to store the current SQL query for explanation
    const [currentSqlQuery, setCurrentSqlQuery] = useState<string | null>(null);
    // State to store the query explanation
    const [queryExplanation, setQueryExplanation] = useState<string | null>(null);
    // State to toggle between table and chart view
    const [showChart, setShowChart] = useState<boolean>(false);
    // State for schema fields autocomplete
    const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
    // State for autocomplete dropdown
    const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
    // State for filtered schema fields
    const [filteredFields, setFilteredFields] = useState<SchemaField[]>([]);
    // State for cursor position
    const [cursorPosition, setCursorPosition] = useState<number>(0);
    // State for selected autocomplete item
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    // State for schema loading
    const [isLoadingSchema, setIsLoadingSchema] = useState<boolean>(true);
    // Ref for textarea
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Fetch schema fields when component mounts
    useEffect(() => {
        const fetchSchemaFields = async () => {
            setIsLoadingSchema(true);
            toast.loading("Introspecting Schema...", {
                id: "schema-toast",
                duration: Infinity,
            });

            try {
                const response = await fetch("/api/schema");
                if (!response.ok) {
                    throw new Error("Failed to fetch schema fields");
                }
                const data = await response.json();

                // Format fields as SchemaField objects
                const formattedFields = data.fields.map((field: string) => {
                    // Use the full field path as both value and label
                    return {
                        value: field,
                        label: field // Format as dataset_id.table_id.field_name
                    };
                });

                setSchemaFields(formattedFields);
                toast.success("Schema loaded successfully", {
                    id: "schema-toast",
                    duration: 3000,
                });
            } catch (error) {
                console.error("Error fetching schema fields:", error);
                toast.error("Failed to load schema fields for autocomplete", {
                    id: "schema-toast",
                    duration: 5000,
                });
            } finally {
                setIsLoadingSchema(false);
            }
        };

        fetchSchemaFields();
    }, []);

    // Handle input change with autocomplete
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setQueryInput(value);

        // Get cursor position
        const cursorPos = e.target.selectionStart || 0;
        setCursorPosition(cursorPos);

        // Check if we should show autocomplete
        const textBeforeCursor = value.substring(0, cursorPos);
        const atSymbolIndex = textBeforeCursor.lastIndexOf("@");

        if (atSymbolIndex !== -1 && atSymbolIndex < cursorPos) {
            // Get the text between @ and cursor
            const searchText = textBeforeCursor.substring(atSymbolIndex + 1).toLowerCase();

            // Filter schema fields based on search text
            const filtered = schemaFields.filter(field =>
                field.label.toLowerCase().includes(searchText)
            ).slice(0, 20); // Increased limit to 20 results

            setFilteredFields(filtered);
            setShowAutocomplete(filtered.length > 0);
            setSelectedIndex(0); // Reset selected index when filtering changes
        } else {
            setShowAutocomplete(false);
        }
    };

    // Effect to scroll selected item into view
    useEffect(() => {
        if (showAutocomplete && selectedIndex >= 0) {
            const selectedItem = document.getElementById(`autocomplete-item-${selectedIndex}`);
            if (selectedItem) {
                selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedIndex, showAutocomplete]);

    // Handle keyboard navigation for autocomplete
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showAutocomplete) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredFields.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
                break;
            case 'Enter':
                if (filteredFields.length > 0) {
                    e.preventDefault();
                    handleSelectField(filteredFields[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowAutocomplete(false);
                break;
        }
    };

    // Handle selection from autocomplete
    const handleSelectField = (field: SchemaField) => {
        // Get the text before and after the @ symbol
        const textBeforeCursor = queryInput.substring(0, cursorPosition);
        const atSymbolIndex = textBeforeCursor.lastIndexOf("@");
        const textBeforeAt = queryInput.substring(0, atSymbolIndex);
        const textAfterCursor = queryInput.substring(cursorPosition);

        // Replace the text between @ and cursor with the selected field
        const newText = `${textBeforeAt}@${field.label}${textAfterCursor}`;
        setQueryInput(newText);

        // Close autocomplete
        setShowAutocomplete(false);

        // Focus back on textarea and set cursor position after the inserted field
        if (textareaRef.current) {
            textareaRef.current.focus();
            const newCursorPos = atSymbolIndex + field.label.length + 1; // +1 for the @ symbol
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (queryInput.trim()) {
            setProgress(0); // Reset progress
            setCurrentQuery(queryInput); // Trigger fetch with the new query
            toast.info("Processing your query...", {
                id: "query-toast",
                duration: Infinity, // Keep it open until we update it
            });
        }
    };

    // Reset conversation (clear memory)
    const resetConversation = () => {
        setMessages([]);
        setSessionId(uuidv4());
        setQueryResult(null);
        setCurrentSqlQuery(null);
        setQueryExplanation(null);
        setShowChart(false);
    };

    // Scroll to bottom of messages when new messages are added
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Effect to handle fetching data when currentQuery changes
    useEffect(() => {
        if (currentQuery) {
            // Abort any ongoing fetch
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create a new AbortController
            abortControllerRef.current = new AbortController();

            // Reset states for new query
            setQueryResult(null);
            setCurrentSqlQuery(null);
            setQueryExplanation(null);
            setShowChart(false);

            // Set fetching state and add user query to messages
            setIsFetching(true);
            setProgress(10); // Initial progress
            toast.loading("Analyzing your query...", {
                id: "query-toast",
            });
            setMessages(prev => [
                ...prev,
                {
                    type: 'user_query',
                    content: currentQuery,
                    timestamp: new Date()
                }
            ]);

            // Fetch data using fetchEventSource
            fetchEventSource("/api/sql", {
                headers: {
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    prompt: currentQuery,
                    sessionId: sessionId
                }),
                signal: abortControllerRef.current.signal,
                onmessage(ev) {
                    console.log(`Received event: ${ev.event}`); // Debugging
                    console.log('Raw data:', ev.data);

                    // Update progress based on event type
                    if (ev.event === 'info') {
                        setProgress(25);
                        toast.loading("Processing query...", {
                            id: "query-toast",
                        });
                    } else if (ev.event === 'tool_call' && ev.data.includes('db_query_tool')) {
                        setProgress(50);
                        toast.loading("Executing SQL query...", {
                            id: "query-toast",
                        });
                    } else if (ev.event === 'tool_response' && ev.data.includes('db_query_tool')) {
                        setProgress(75);
                        toast.loading("Analyzing results...", {
                            id: "query-toast",
                        });
                    } else if (ev.event === 'final_answer') {
                        setProgress(100);
                        toast.success("Query completed successfully!", {
                            id: "query-toast",
                            duration: 3000,
                        });
                    } else if (ev.event === 'error') {
                        setProgress(100);
                        toast.error("Error processing query", {
                            id: "query-toast",
                            duration: 3000,
                        });
                    }

                    // Store query result for visualization
                    if (ev.event === 'tool_response' && ev.data.includes('Tool Response: db_query_tool')) {
                        const contentMatch = ev.data.match(/Content: ([\s\S]*)/);
                        if (contentMatch && contentMatch[1]) {
                            try {
                                // Extract and parse the JSON data
                                const rawData = contentMatch[1].trim();
                                const parsedData = JSON.parse(rawData);
                                console.log("Parsed query result:", parsedData);
                                setQueryResult(parsedData);
                            } catch (error) {
                                console.error("Error parsing query result:", error);
                                setQueryResult(null);
                            }
                        }
                    }

                    // Store SQL query for explanation
                    if (ev.event === 'query_generated') {
                        const queryMatch = ev.data.match(/Generated Query: ([\s\S]*)/);
                        if (queryMatch && queryMatch[1]) {
                            setCurrentSqlQuery(queryMatch[1]);
                        }
                    }

                    // Store query explanation
                    if (ev.event === 'query_explanation') {
                        const explanationMatch = ev.data.match(/Query Explanation: ([\s\S]*)/);
                        if (explanationMatch && explanationMatch[1]) {
                            setQueryExplanation(explanationMatch[1]);
                        }
                    }

                    // Add the new message with its type
                    setMessages((prev) => [
                        ...prev,
                        {
                            type: ev.event as MessageType,
                            content: ev.data,
                            timestamp: new Date()
                        }
                    ]);
                },
                onclose() {
                    setIsFetching(false); // Reset fetching state when stream closes
                    // Ensure toast is closed if not already updated
                    if (progress < 100) {
                        setProgress(100);
                        toast.success("Query completed", {
                            id: "query-toast",
                            duration: 3000,
                        });
                    }
                },
            });

            // Cleanup function to abort fetch on unmount or new query
            return () => {
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }
            };
        }
    }, [currentQuery]);

    // Function to render a message based on its type
    const renderMessage = (message: Message, index: number) => {
        const { type, content } = message;

        switch (type) {
            case 'user_query':
                return (
                    <Card key={index} className="mb-4 bg-indigo-50">
                        <CardHeader>
                            <CardTitle className="text-indigo-700">Your Query</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-indigo max-w-none text-indigo-900 font-medium">
                                <ReactMarkdown>
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                    </Card>
                );

            case 'info':
                return (
                    <Card key={index} className="mb-4 bg-blue-50">
                        <CardContent className="pt-4">
                            <div className="prose prose-blue max-w-none text-blue-700">
                                <ReactMarkdown>
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                    </Card>
                );

            case 'tool_call':
                return (
                    <Card key={index} className="mb-4 bg-purple-50">
                        <Collapsible>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-purple-700">Tool Call</CardTitle>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <ChevronsDownUp className="size-6" />
                                    </Button>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent>
                                    <pre className="whitespace-pre-wrap text-purple-900 bg-purple-100 p-2 rounded">
                                        {content}
                                    </pre>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                );

            case 'tool_response':
                // Special handling for query results to enable visualization
                if (content.includes('Tool Response: db_query_tool')) {
                    return (
                        <Card key={index} className="mb-4 bg-gray-50">
                            <Collapsible defaultOpen={false}>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-gray-700">Query Results</CardTitle>
                                    <div className="flex space-x-2">
                                        <Button
                                            variant={!showChart ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setShowChart(false)}
                                        >
                                            Table
                                        </Button>
                                        <Button
                                            variant={showChart ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setShowChart(true)}
                                        >
                                            Chart
                                        </Button>
                                        <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <ChevronsDownUp className="size-6" />
                                            </Button>
                                        </CollapsibleTrigger>
                                    </div>
                                </CardHeader>
                                <CollapsibleContent>
                                    <CardContent>
                                        {!showChart ? (
                                            <div className="whitespace-pre-wrap text-gray-900 bg-gray-100 p-2 rounded font-mono overflow-x-auto">
                                                {content.replace('Tool Response: db_query_tool\nContent: ', '')}
                                            </div>
                                        ) : (
                                            queryResult ? (
                                                <div className="h-[800px] w-full">
                                                    <DataChart
                                                        data={queryResult}
                                                        title={`${queryResult.length} Results`}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-64">
                                                    No data available for visualization
                                                </div>
                                            )
                                        )}
                                    </CardContent>
                                </CollapsibleContent>
                            </Collapsible>
                        </Card>
                    );
                }

                // Default rendering for other tool responses
                return (
                    <Card key={index} className="mb-4 bg-gray-50">
                        <Collapsible>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-gray-700">Tool Response</CardTitle>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <ChevronsDownUp className="size-6" />
                                    </Button>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent>
                                    <div className="whitespace-pre-wrap text-gray-900 bg-gray-100 p-2 rounded font-mono">
                                        {content}
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                );

            case 'query_generated':
                return (
                    <Card key={index} className="mb-4 bg-amber-50">
                        <CardHeader>
                            <CardTitle className="text-amber-700">Generated SQL Query</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="whitespace-pre-wrap text-amber-900 bg-amber-100 p-2 rounded font-mono">
                                {content.replace('Generated Query: ', '')}
                            </pre>
                        </CardContent>
                    </Card>
                );

            case 'query_explanation':
                return (
                    <Card key={index} className="mb-4 bg-blue-50">
                        <Collapsible>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-blue-700">SQL Query Explanation</CardTitle>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <ChevronsDownUp className="size-6" />
                                    </Button>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent>
                                    <div className="prose prose-blue max-w-none bg-blue-100 p-2 rounded">
                                        <ReactMarkdown>
                                            {content.replace('Query Explanation: ', '')}
                                        </ReactMarkdown>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                );

            case 'final_answer':
                return (
                    <Card key={index} className="mb-4 bg-green-50">
                        <CardHeader>
                            <CardTitle className="text-green-700">Answer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-green max-w-none text-green-900">
                                <ReactMarkdown>
                                    {content.replace('Final Answer: ', '')}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                    </Card>
                );

            case 'error':
                return (
                    <Card key={index} className="mb-4 bg-red-50">
                        <CardHeader>
                            <CardTitle className="text-red-700">Error</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-red max-w-none text-red-900">
                                <ReactMarkdown>
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                    </Card>
                );

            default:
                return (
                    <Card key={index} className="mb-4">
                        <CardContent className="pt-4">
                            <div className="prose max-w-none">
                                <ReactMarkdown>
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </CardContent>
                    </Card>
                );
        }
    };

    // Render a brief summary of the query results
    const renderResultSummary = () => {
        if (!queryResult) return null;

        try {
            // Generate a simple summary based on the data
            const count = queryResult.length;
            let summary = `Found ${count} result${count !== 1 ? 's' : ''}.`;

            // Add more insights if we have data
            if (count > 0 && typeof queryResult[0] === 'object') {
                const keys = Object.keys(queryResult[0]);
                if (keys.length > 0) {
                    summary += ` Showing data for ${keys.join(', ')}.`;
                }
            }

            return (
                <div className="mt-2 text-sm text-muted-foreground">
                    {summary}
                </div>
            );
        } catch (error) {
            return null;
        }
    };

    return (
        <>
            <Card className="container mx-auto p-4 mt-8">
                {/* <CardHeader>
                    <CardTitle>SQL Data Explorer</CardTitle>
                    <CardDescription>Ask questions about your data in natural language</CardDescription>
                </CardHeader> */}
                <CardContent>
                    {/* Form with Input and Submit Button */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <Label htmlFor="message">Your Query</Label>
                        <div className="relative">
                            <Textarea
                                ref={textareaRef}
                                value={queryInput}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder={isLoadingSchema ? "Loading schema fields..." : "Enter your query about the database (use @ to autocomplete schema fields)"}
                                disabled={isFetching || isLoadingSchema}
                                className="min-h-24"
                            />

                            {showAutocomplete && (
                                <div className="absolute z-10 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                                    <div className="p-1">
                                        <table className="w-full border-collapse">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Field Name</th>
                                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Dataset.Table</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredFields.map((field, index) => {
                                                    // Split the field label into parts
                                                    const parts = field.label.split('.');
                                                    const fieldName = parts[2] || ''; // field_id
                                                    const datasetTable = `${parts[0]}.${parts[1]}` || ''; // dataset_id.table_id

                                                    return (
                                                        <tr
                                                            key={index}
                                                            id={`autocomplete-item-${index}`}
                                                            className={`hover:bg-gray-100 cursor-pointer ${selectedIndex === index ? 'bg-gray-100' : ''}`}
                                                            onClick={() => handleSelectField(field)}
                                                        >
                                                            <td className="px-2 py-1 border-t border-gray-100 font-medium">{fieldName}</td>
                                                            <td className="px-2 py-1 border-t border-gray-100 text-gray-500 text-sm">{datasetTable}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={resetConversation}
                        disabled={isFetching}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" /> New Conversation
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isFetching || !queryInput.trim() || isLoadingSchema}
                        className="relative"
                    >
                        {isFetching ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing... {progress}%
                                <div
                                    className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </>
                        ) : "Submit"}
                    </Button>
                </CardFooter>
            </Card>

            {/* Sample Queries */}
            {messages.length === 0 && (
                <SampleQueries onSelectQuery={(query) => setQueryInput(query)} />
            )}

            {/* SQL Query Display */}
            {currentSqlQuery && (
                <Card className="container mx-auto p-4 mt-8">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>SQL Query</CardTitle>
                        {queryExplanation && (
                            <QueryExplanation
                                query={currentSqlQuery}
                                explanation={queryExplanation}
                            />
                        )}
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto whitespace-pre-wrap text-sm font-mono">
                            {currentSqlQuery}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* Query Results */}
            {queryResult && (
                <Card className="container mx-auto p-4 mt-8">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>Query Results</CardTitle>
                        <div className="flex items-center space-x-2">
                            <div className="flex space-x-2">
                                <Button
                                    variant={!showChart ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowChart(false)}
                                    className="gap-2"
                                >
                                    <Table className="h-4 w-4" />
                                    Table
                                </Button>
                                <Button
                                    variant={showChart ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowChart(true)}
                                    className="gap-2"
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    Chart
                                </Button>
                            </div>
                            <RawLogsDialog messages={messages} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {!showChart ? (
                            <div className="overflow-x-auto mb-4">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-muted">
                                            {queryResult.length > 0 && Object.keys(queryResult[0]).map((key, i) => (
                                                <th key={i} className="p-2 text-left font-medium text-muted-foreground">
                                                    {key}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queryResult.map((row, i) => (
                                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                                                {Object.values(row).map((value, j) => (
                                                    <td key={j} className="p-2 border-t">
                                                        {value === null ? "NULL" : String(value)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {renderResultSummary()}
                            </div>
                        ) : (
                            <DataChart
                                data={queryResult}
                                title={`${queryResult.length} Results`}
                            />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Final Answer */}
            {messages.some(m => m.type === 'final_answer') && (
                <Card className="container mx-auto p-4 mt-8 bg-green-50">
                    <CardHeader>
                        <CardTitle className="text-green-700 text-center">ANSWER</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-green max-w-none text-green-900">
                            <ReactMarkdown>
                                {messages.find(m => m.type === 'final_answer')?.content.replace('Final Answer: ', '') || ''}
                            </ReactMarkdown>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}

export default StreamingComponent;

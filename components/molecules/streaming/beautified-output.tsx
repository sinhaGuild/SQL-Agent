import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Typography from "@/components/atomic/typography";

export default function BeautifiedOutput({ messages }: { messages: any }) {

    return (
        <Card className={cn(
            "m-4 bg-slate-50 p-4 container mx-auto",
            messages.length === 0 && "hidden"
        )}>
            <CardHeader>
                <Typography variant="h1" className="tracking-wide">Query Results</Typography>
            </CardHeader>
            <CardContent>
                {messages.map((msg: string, index: number) => {
                    // Split multi-line messages into individual lines
                    const lines = msg.split("\n");
                    return (
                        <div key={index} className="mb-4">
                            <Card className="p-4"
                            >
                                {lines.map((line, i) => {
                                    // Skip empty lines
                                    if (!line.trim()) return null;

                                    // Tool Called
                                    if (line.startsWith("Tool Called:")) {
                                        return (
                                            <CardHeader key={i} variant={"tool"}>
                                                <CardTitle>
                                                    <Typography variant="h3">
                                                        {line}
                                                    </Typography>
                                                </CardTitle>
                                            </CardHeader>
                                        );
                                    }
                                    // Tool Response
                                    else if (line.startsWith("Tool Response:")) {
                                        return (
                                            <CardHeader key={i} variant={"response"}>
                                                <CardTitle>
                                                    <Typography variant="h3">
                                                        {line}
                                                    </Typography>
                                                </CardTitle>
                                            </CardHeader>
                                        );
                                    }
                                    // Content (general)
                                    else if (line.startsWith("Content:")) {
                                        const content = line.replace("Content: ", "");
                                        // Handle schema content with list
                                        if (content.startsWith("Schema for table")) {
                                            const schemaLines = lines.slice(i + 1); // Get all subsequent lines until next message
                                            return (
                                                <CardContent key={i}>
                                                    <div >
                                                        {/* <p className="font-semibold">{content}</p> */}
                                                        <Typography variant="h2">{content}</Typography>
                                                        <ul className="list-none pl-4">
                                                            {schemaLines.map((schemaLine, j) => {
                                                                if (!schemaLine.trim() || schemaLine.startsWith("Tool") || schemaLine.startsWith("Generated") || schemaLine.startsWith("Final")) {
                                                                    return null; // Stop at next section
                                                                }
                                                                return <li key={j}>
                                                                    <Typography variant="code">
                                                                        {schemaLine}
                                                                    </Typography>
                                                                </li>;
                                                            })}
                                                        </ul>
                                                    </div>
                                                </CardContent>
                                            );
                                        }
                                        // Handle other content (e.g., query result)
                                        else {
                                            return (
                                                <CardContent key={i}>
                                                    <Typography variant="p">
                                                        {content}
                                                    </Typography>
                                                </CardContent>)
                                        }
                                    }
                                    // Table_name
                                    else if (line.startsWith("Table_name:")) {
                                        return (
                                            <CardContent key={i}>
                                                <Typography variant="lead">
                                                    {line}
                                                </Typography>

                                            </CardContent>
                                        );
                                    }
                                    // Generated Query or Query
                                    else if (line.startsWith("Generated Query:") || line.startsWith("Query:")) {
                                        const query = line.replace(/^(Generated Query|Query): /, "");
                                        return (
                                            <div key={i}>
                                                <CardHeader variant={"code"}>
                                                    <CardTitle>
                                                        <Typography variant="h3">Query</Typography>
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <pre className="bg-gray-100 p-2 rounded whitespace-pre-wrap">
                                                        <Typography variant="code">
                                                            {query}
                                                        </Typography>
                                                    </pre>
                                                </CardContent>
                                            </div>
                                        );
                                    }
                                    // Final Answer
                                    else if (line.startsWith("Final Answer:")) {
                                        return (<div key={i}>
                                            <CardHeader variant={"answer"}>
                                                <Typography variant="h2">Final Answer</Typography>
                                            </CardHeader>
                                            <CardContent>
                                                <Typography key={i} variant="h3" className="text-center">
                                                    {line}
                                                </Typography>

                                            </CardContent>
                                        </div>
                                        );
                                    }
                                    // Fallback for unhandled lines
                                    else {
                                        return (
                                            <div key={i}></div>
                                            // <CardContent>
                                            //     <p key={i} className="text-base">
                                            //         {line}
                                            //     </p>
                                            // </CardContent>
                                        );
                                    }
                                })}
                            </Card>
                        </div>
                    );
                }).reverse()}
            </CardContent>
        </Card>
    );
}

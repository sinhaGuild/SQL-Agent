import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Refines a SQL query based on error messages or validation issues
 * @param query The original SQL query
 * @param error The error message or validation issue
 * @param schema Optional schema information to help with refinement
 * @returns A refined SQL query
 */
export async function refineQuery(
    query: string,
    error: string,
    schema?: string
): Promise<string> {
    const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

    let systemPrompt = "You are a SQL expert. Fix the provided BigQuery SQL query based on the error message.";

    if (schema) {
        systemPrompt += " Use the provided schema information to ensure the query is valid.";
    }

    const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Fix this BigQuery SQL query:
\`\`\`sql
${query}
\`\`\`

Error: ${error}
${schema ? `\nSchema information:\n${schema}` : ''}

Return ONLY the fixed SQL query without any explanations or markdown formatting.`)
    ];

    const refinementResponse = await llm.invoke(messages);

    // Extract just the SQL query from the response
    let refinedQuery = refinementResponse.content as string;

    // Remove any markdown code blocks if present
    refinedQuery = refinedQuery.replace(/```sql\n/g, '').replace(/```/g, '').trim();

    return refinedQuery;
}

/**
 * Validates and refines a SQL query through multiple iterations if needed
 * @param query The original SQL query
 * @param validateFn A function that validates the query
 * @param schema Optional schema information
 * @param maxAttempts Maximum number of refinement attempts
 * @returns The final validated query and validation result
 */
export async function validateAndRefineQuery(
    query: string,
    validateFn: (query: string) => Promise<{ valid: boolean; error?: string }>,
    schema?: string,
    maxAttempts: number = 3
): Promise<{ query: string; validationResult: { valid: boolean; error?: string } }> {
    let currentQuery = query;
    let attempts = 0;
    let validationResult: { valid: boolean; error?: string };

    do {
        validationResult = await validateFn(currentQuery);

        if (validationResult.valid) {
            break;
        }

        if (attempts >= maxAttempts) {
            break;
        }

        // Refine the query based on the validation error
        currentQuery = await refineQuery(currentQuery, validationResult.error || "Invalid query", schema);
        attempts++;

    } while (!validationResult.valid && attempts < maxAttempts);

    return {
        query: currentQuery,
        validationResult
    };
}

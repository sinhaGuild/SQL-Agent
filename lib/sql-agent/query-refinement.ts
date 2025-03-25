import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { validateNullHandling, validateTableNames } from "./query-validation";

/**
 * Adds LIMIT clause to a query if it doesn't have one
 * @param query SQL query to modify
 * @param maxRows Maximum number of rows to return
 * @returns Modified query with LIMIT clause
 */
function addQueryLimit(query: string, maxRows: number = 1000): string {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery.includes('limit')) {
        return `${query.trim()} LIMIT ${maxRows}`;
    }
    return query;
}

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

    // Handle JSON parsing errors
    if (error.includes('not valid JSON')) {
        // Remove any invalid characters and try to extract just the SQL
        query = query.replace(/^(Query exec|Error exec).*?```sql\s*/i, '')
            .replace(/```[\s\S]*$/, '')
            .trim();
    }

    let systemPrompt = `You are a SQL expert. Fix the provided BigQuery SQL query based on the error message.
Key requirements:
- Wrap table names containing hyphens in backticks or double quotes
- Use COALESCE for numeric operations to handle null values
- Keep queries efficient and within context limits`;

    if (schema) {
        systemPrompt += " Use the provided schema information to ensure the query is valid.";
    }

    const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Fix this BigQuery SQL query and ensure it follows best practices:
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

    // Add LIMIT if not present to control result size
    refinedQuery = addQueryLimit(refinedQuery);

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
    let validationResult: { valid: boolean; error?: string } = { valid: true };

    // Add LIMIT if not present to control result size
    currentQuery = addQueryLimit(currentQuery);

    do {
        // Run all validations
        const tableNameValidation = validateTableNames(currentQuery);
        if (!tableNameValidation.valid) {
            currentQuery = await refineQuery(currentQuery, tableNameValidation.error || '', schema);
            attempts++;
            continue;
        }

        const nullHandlingValidation = validateNullHandling(currentQuery);
        if (!nullHandlingValidation.valid) {
            currentQuery = await refineQuery(currentQuery, nullHandlingValidation.error || '', schema);
            attempts++;
            continue;
        }

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

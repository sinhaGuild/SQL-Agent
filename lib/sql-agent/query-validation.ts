import { Parser } from 'node-sql-parser';

/**
 * Validates SQL syntax using node-sql-parser
 * @param query SQL query to validate
 * @returns Object indicating if the query is valid and any error message
 */
export function validateSqlSyntax(query: string): { valid: boolean; error?: string } {
    const parser = new Parser();
    try {
        const { ast } = parser.parse(query);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Checks if a query is read-only (SELECT only)
 * @param query SQL query to check
 * @returns True if the query is read-only, false otherwise
 */
export function isReadOnlyQuery(query: string): boolean {
    const normalizedQuery = query.trim().toUpperCase();
    const writeOperations = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
    return !writeOperations.some(op => normalizedQuery.includes(op));
}

/**
 * Validates that the query references valid tables and columns based on schema
 * @param query SQL query to validate
 * @param schema Schema information string
 * @returns Object indicating if the query is valid and any error message
 */
export function validateSchemaCompatibility(query: string, schema: string): { valid: boolean; error?: string } {
    try {
        // Extract table name from schema
        const schemaFirstLine = schema.split('\n')[0];
        const tableNameMatch = schemaFirstLine.match(/Schema for table (.+):/);
        if (!tableNameMatch) {
            return { valid: false, error: "Could not extract table name from schema" };
        }
        const tableName = tableNameMatch[1];

        // Extract column names from the schema
        const schemaLines = schema.split('\n');
        const columns = schemaLines
            .filter(line => line.startsWith('- '))
            .map(line => {
                const columnInfo = line.substring(2).split(' ');
                return {
                    name: columnInfo[0].toLowerCase(),
                    type: columnInfo[1].replace(/[()]/g, '')
                };
            });

        // Simple check for table reference in the query
        const queryLower = query.toLowerCase();
        if (!queryLower.includes(tableName.toLowerCase())) {
            return {
                valid: false,
                error: `Query does not reference the table ${tableName}`
            };
        }

        // Check for invalid column references
        // This is a simplified check and might not catch all cases
        const parser = new Parser();
        try {
            const { ast } = parser.parse(query);

            // For now, we'll just do a basic check that the query doesn't reference non-existent columns
            // A more sophisticated check would analyze the AST to extract column references
            const columnNames = columns.map(col => col.name);
            const queryWords = queryLower.split(/\s+|,|\(|\)|\./);

            const invalidColumns = queryWords.filter(word =>
                !columnNames.includes(word) &&
                word.length > 0 &&
                !['select', 'from', 'where', 'group', 'by', 'having', 'order', 'limit', 'offset', 'and', 'or', 'not', 'as', 'join', 'on', 'inner', 'outer', 'left', 'right', 'full', 'cross', 'union', 'all', 'distinct', 'count', 'sum', 'avg', 'min', 'max', '*'].includes(word) &&
                !word.match(/^\d+$/) // Ignore numbers
            );

            // If we find potential invalid columns, return a warning but still consider it valid
            // since our check is not comprehensive
            if (invalidColumns.length > 0) {
                return {
                    valid: true,
                    error: `Warning: Query may reference columns not in schema: ${invalidColumns.join(', ')}`
                };
            }

            return { valid: true };
        } catch (error) {
            // If parsing fails, we already validated syntax earlier, so this is likely a different issue
            return { valid: true };
        }
    } catch (error) {
        return {
            valid: false,
            error: `Schema compatibility check error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Checks if a query is too complex (e.g., too many joins, nested subqueries)
 * @param query SQL query to check
 * @returns Object indicating if the query is valid and any error message
 */
export function validateQueryComplexity(query: string): { valid: boolean; error?: string } {
    // Check for multiple JOINs
    const joinCount = (query.match(/join/gi) || []).length;
    if (joinCount > 3) {
        return {
            valid: false,
            error: `Query has too many joins (${joinCount}). Maximum allowed is 3.`
        };
    }

    // Check for nested subqueries
    const subqueryCount = (query.match(/\(select/gi) || []).length;
    if (subqueryCount > 2) {
        return {
            valid: false,
            error: `Query has too many nested subqueries (${subqueryCount}). Maximum allowed is 2.`
        };
    }

    return { valid: true };
}

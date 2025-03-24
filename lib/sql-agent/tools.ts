import { BigQuery } from "@google-cloud/bigquery";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Setup BigQuery client
const projectId = process.env.GOOGLE_PROJECT_ID;
// console.log(projectId)
const bigqueryClient = new BigQuery({ projectId });

/**
 * Tool to list all tables in BigQuery
 */
export class ListTablesToolBigQuery extends StructuredTool {
    name = "list_tables_bigquery";
    description = "List all tables in the BigQuery database.";
    schema = z.object({});

    async _call() {
        try {
            const [datasets] = await bigqueryClient.getDatasets();

            let tablesList: string[] = [];

            for (const dataset of datasets) {
                const datasetId = dataset.id;
                const [tables] = await dataset.getTables();

                for (const table of tables) {
                    tablesList.push(`${datasetId}.${table.id}`);
                }
            }

            if (tablesList.length === 0) {
                return "No tables found in the database.";
            }

            return `Tables in the database:\n${tablesList.join('\n')}`;
        } catch (error) {
            return `Error listing tables: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}

/**
 * Tool to get schema information for a specific table
 */
export class GetSchemaToolBigQuery extends StructuredTool {
    name = "sql_db_schema";
    description = "Get schema information about specified tables in the database.";
    schema = z.object({
        table_name: z.string().describe("The name of the table to get schema for (format: dataset.table)")
    });

    async _call({ table_name }: { table_name: string }) {
        try {
            const [datasetId, tableId] = table_name.split(".");

            if (!datasetId || !tableId) {
                return `Error: Invalid table name format. Expected 'dataset.table', got '${table_name}'`;
            }

            const dataset = bigqueryClient.dataset(datasetId);
            const table = dataset.table(tableId);

            const [metadata] = await table.getMetadata();
            const schema = metadata.schema.fields;

            const schemaInfo = [`Schema for table ${table_name}:`];

            for (const field of schema) {
                schemaInfo.push(`- ${field.name} (${field.type})`);
            }

            return schemaInfo.join('\n');
        } catch (error) {
            return `Error getting schema for table ${table_name}: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}

/**
 * Tool to execute a SQL query against BigQuery
 */
export class DbQueryToolBigQuery extends StructuredTool {
    name = "db_query_tool";
    description = "Execute a SQL query against the BigQuery database and get back the result.";
    schema = z.object({
        query: z.string().describe("The SQL query to execute")
    });

    /**
     * Validates a SQL query without executing it
     * @param query The SQL query to validate
     * @returns Object indicating if the query is valid and any error message
     */
    async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
        try {
            const [job] = await bigqueryClient.createQueryJob({
                query,
                dryRun: true, // Validates the query without executing it
            });
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async _call({ query }: { query: string }) {
        try {
            const [job] = await bigqueryClient.createQueryJob({ query });
            const [rows] = await job.getQueryResults();

            if (rows.length === 0) {
                return "Query executed successfully but returned no results.";
            }

            // Convert rows to a format suitable for visualization
            const result = rows.map(row => {
                // Keep the original object structure but handle special values
                const formattedRow = Object.entries(row).reduce((acc, [key, value]) => {
                    acc[key] = value === null ? null :
                        typeof value === 'object' ? JSON.stringify(value) : value;
                    return acc;
                }, {} as Record<string, any>);
                return formattedRow;
            });

            // Log the result for debugging
            console.log('Query result:', JSON.stringify(result, null, 2));
            return JSON.stringify(result, null, 2);
        } catch (error) {
            return `Error executing query: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}

// Create instances of the tools
export const listTablesToolBigQuery = new ListTablesToolBigQuery();
export const getSchemaToolBigQuery = new GetSchemaToolBigQuery();
export const dbQueryToolBigQuery = new DbQueryToolBigQuery();

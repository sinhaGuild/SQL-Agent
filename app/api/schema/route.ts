import { BigQuery } from "@google-cloud/bigquery";
import { NextRequest, NextResponse } from "next/server";

// Setup BigQuery client
const projectId = "shunyasea-sanskriti";
const bigqueryClient = new BigQuery({ projectId });

export async function GET(req: NextRequest) {
    try {
        // Get all datasets
        const [datasets] = await bigqueryClient.getDatasets();

        // Store all schema fields in format "dataset_id.table_id.field_name"
        const schemaFields: string[] = [];

        // Log the process for debugging
        console.log(`Fetching schema fields from ${datasets.length} datasets`);

        // Iterate through all datasets and tables to get schema information
        for (const dataset of datasets) {
            const datasetId = dataset.id;
            console.log(`Processing dataset: ${datasetId}`);

            try {
                const [tables] = await dataset.getTables();
                console.log(`Found ${tables.length} tables in dataset ${datasetId}`);

                for (const table of tables) {
                    const tableId = table.id;
                    console.log(`Processing table: ${datasetId}.${tableId}`);

                    try {
                        const [metadata] = await table.getMetadata();
                        const schema = metadata.schema?.fields || [];
                        console.log(`Found ${schema.length} fields in table ${datasetId}.${tableId}`);

                        // Add each field to the list in the format "dataset_id.table_id.field_name"
                        for (const field of schema) {
                            schemaFields.push(`${datasetId}.${tableId}.${field.name}`);
                        }
                    } catch (tableError) {
                        console.error(`Error fetching metadata for table ${datasetId}.${tableId}:`, tableError);
                        // Continue with other tables even if one fails
                    }
                }
            } catch (datasetError) {
                console.error(`Error fetching tables for dataset ${datasetId}:`, datasetError);
                // Continue with other datasets even if one fails
            }
        }

        console.log(`Total schema fields found: ${schemaFields.length}`);
        return NextResponse.json({ fields: schemaFields });
    } catch (error) {
        console.error("Error fetching schema information:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

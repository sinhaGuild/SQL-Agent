import { loadChatHistory, saveToMemory } from "@/lib/memory";
import { validateAndRefineQuery } from "@/lib/sql-agent/query-refinement";
import { 
  isReadOnlyQuery, 
  validateSchemaCompatibility, 
  validateSqlSyntax,
  validateQueryComplexity
} from "@/lib/sql-agent/query-validation";
import {
  dbQueryToolBigQuery,
  getSchemaToolBigQuery,
  listTablesToolBigQuery
} from "@/lib/sql-agent/tools";
import {
  HumanMessage,
  SystemMessage
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";

// Constants for prompts
const QUERY_GEN_INSTRUCTION = `You are a SQL expert with a strong attention to detail.
You can define SQL queries, analyze query results and interpret query results to provide an answer.
Read the user's question and the database schema information, then:
1. Create a syntactically correct BigQuery SQL query to answer the user question. DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.
2. Your query MUST be a valid BigQuery SQL query. Do not include any explanations or comments, just the raw SQL query.
3. Always start your query with SELECT, never with other keywords like TO, WITH, etc.
4. If you encounter an error when executing the query, fix the query and try again.
5. Once you have the query results, interpret them and answer the question following this pattern: Answer: <<question answer>>.`;

const QUERY_EXPLANATION_INSTRUCTION = `You are a SQL expert who can explain SQL queries in a clear, educational way.
Given a SQL query, provide a detailed explanation of what the query does, breaking down each part:
1. Explain the overall purpose of the query
2. Break down each clause (SELECT, FROM, WHERE, GROUP BY, etc.) and explain what it does
3. Explain any functions, operators, or special syntax used
4. Describe how the data is being filtered, grouped, or transformed
Your explanation should be educational and help someone understand both what the query is doing and why it's structured that way.`;

// Format message for streaming
function formatMessage(message: any, type: string) {
  let event = type;
  let data = "";

  if (type === "tool_response") {
    data = `Tool Response: ${message.name || "Unknown Tool"}\nContent: ${message.content}`;
  } else if (type === "tool_call") {
    const toolName = message.name;
    const args = message.args;

    if (toolName === "list_tables_bigquery") {
      data = "Tool Called: list_tables_bigquery";
    } else if (toolName === "sql_db_schema") {
      data = `Tool Called: sql_db_schema\nTable_name: ${args.table_name}`;
    } else if (toolName === "db_query_tool") {
      data = `Tool Called: db_query_tool\nQuery: ${args.query}`;
    } else {
      data = `Tool Called: ${toolName}\nArgs: ${JSON.stringify(args)}`;
    }
  } else if (type === "final_answer") {
    data = `Final Answer: ${message.content}`;
  } else if (type === "query_generated") {
    data = `Generated Query: ${message.content}`;
  } else if (type === "query_explanation") {
    data = `Query Explanation: ${message.content}`;
  } else {
    data = String(message.content);
  }

  return { event, data };
}

// Helper function to create a stream response
function createStream(data: string, event: string) {
  const encoder = new TextEncoder();
  const lines = data.split("\n");

  let streamContent = `event: ${event}\n`;
  for (const line of lines) {
    streamContent += `data: ${line}\n`;
  }
  streamContent += "\n";

  return encoder.encode(streamContent);
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, sessionId = "default" } = await req.json();

    // Load chat history for this session
    const chatHistory = await loadChatHistory(sessionId);

    // Create a ReadableStream to stream the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: List tables
          controller.enqueue(createStream("Starting SQL agent...", "info"));

          // Call the list tables tool
          const listTablesResult = await listTablesToolBigQuery.invoke({});
          const listTablesMessage = formatMessage(
            { content: listTablesResult, name: "list_tables_bigquery" },
            "tool_response"
          );
          controller.enqueue(createStream(listTablesMessage.data, listTablesMessage.event));

          // Step 2: Get schema for a relevant table
          // Use LLM to determine which table to get schema for
          const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

          // Include chat history for context awareness
          const tableSelectionPrompt = `Based on this question: "${prompt}" and these available tables: ${listTablesResult}, which table should I get the schema for? Just respond with the table name in format 'dataset.table'.`;

          const tableSelectionResponse = await llm.invoke([
            ...chatHistory,
            new HumanMessage(tableSelectionPrompt)
          ]);

          const tableName = tableSelectionResponse.content as string;
          controller.enqueue(createStream(`Selecting table: ${tableName}`, "info"));

          // Get schema for the selected table
          const schemaResult = await getSchemaToolBigQuery.invoke({ table_name: tableName.trim() });
          const schemaMessage = formatMessage(
            { content: schemaResult, name: "sql_db_schema" },
            "tool_response"
          );
          controller.enqueue(createStream(schemaMessage.data, schemaMessage.event));

          // Step 3: Generate SQL query
          const queryGenResponse = await llm.invoke([
            new SystemMessage(QUERY_GEN_INSTRUCTION),
            ...chatHistory,
            new HumanMessage(`Question: ${prompt}\n\nAvailable tables: ${listTablesResult}\n\nSchema: ${schemaResult}`)
          ]);

          let generatedQuery = queryGenResponse.content as string;

          // Ensure the query starts with SELECT
          if (!generatedQuery.trim().toUpperCase().startsWith('SELECT')) {
            // Try to extract a valid SQL query if it's embedded in text
            const sqlMatch = generatedQuery.match(/SELECT[\s\S]+?(?:;|$)/i);
            if (sqlMatch) {
              generatedQuery = sqlMatch[0];
            } else {
              // If no valid query found, generate a simple count query as fallback
              generatedQuery = `SELECT COUNT(*) FROM ${tableName}`;
            }
          }
          
          // Step 4: Validate and refine the query
          controller.enqueue(createStream("Validating SQL query...", "info"));
          
          // 4.1: Check if query is read-only
          if (!isReadOnlyQuery(generatedQuery)) {
            controller.enqueue(createStream("Error: Only SELECT queries are allowed. Refining query...", "error"));
            generatedQuery = `SELECT * FROM ${tableName} LIMIT 10`;
          }
          
          // 4.2: Validate SQL syntax
          const syntaxValidation = validateSqlSyntax(generatedQuery);
          if (!syntaxValidation.valid) {
            controller.enqueue(createStream(`SQL syntax error: ${syntaxValidation.error}. Refining query...`, "error"));
            
            // Attempt to refine the query
            const refinedQueryResult = await validateAndRefineQuery(
              generatedQuery,
              async (q) => validateSqlSyntax(q),
              schemaResult
            );
            
            if (refinedQueryResult.validationResult.valid) {
              generatedQuery = refinedQueryResult.query;
              controller.enqueue(createStream("Query refined successfully.", "info"));
            } else {
              // If refinement fails, fall back to a simple query
              generatedQuery = `SELECT * FROM ${tableName} LIMIT 10`;
              controller.enqueue(createStream("Could not refine query. Using fallback query.", "error"));
            }
          }
          
          // 4.3: Validate schema compatibility
          const schemaValidation = validateSchemaCompatibility(generatedQuery, schemaResult);
          if (!schemaValidation.valid) {
            controller.enqueue(createStream(`Schema compatibility error: ${schemaValidation.error}. Refining query...`, "error"));
            
            // Attempt to refine the query
            const refinedQueryResult = await validateAndRefineQuery(
              generatedQuery,
              async (q) => validateSchemaCompatibility(q, schemaResult),
              schemaResult
            );
            
            if (refinedQueryResult.validationResult.valid) {
              generatedQuery = refinedQueryResult.query;
              controller.enqueue(createStream("Query refined successfully.", "info"));
            }
          } else if (schemaValidation.error) {
            // This is just a warning, not an error
            controller.enqueue(createStream(schemaValidation.error, "info"));
          }
          
          // 4.4: Validate query complexity
          const complexityValidation = validateQueryComplexity(generatedQuery);
          if (!complexityValidation.valid) {
            controller.enqueue(createStream(`Query complexity error: ${complexityValidation.error}. Refining query...`, "error"));
            
            // Attempt to refine the query
            const refinedQueryResult = await validateAndRefineQuery(
              generatedQuery,
              async (q) => validateQueryComplexity(q),
              schemaResult
            );
            
            if (refinedQueryResult.validationResult.valid) {
              generatedQuery = refinedQueryResult.query;
              controller.enqueue(createStream("Query refined successfully.", "info"));
            } else {
              // If refinement fails, fall back to a simpler query
              generatedQuery = `SELECT * FROM ${tableName} LIMIT 10`;
              controller.enqueue(createStream("Could not refine query. Using fallback query.", "error"));
            }
          }
          
          // 4.5: Dry run validation using BigQuery
          const dryRunValidation = await dbQueryToolBigQuery.validateQuery(generatedQuery);
          if (!dryRunValidation.valid) {
            controller.enqueue(createStream(`BigQuery validation error: ${dryRunValidation.error}. Refining query...`, "error"));
            
            // Attempt to refine the query
            const refinedQueryResult = await validateAndRefineQuery(
              generatedQuery,
              async (q) => dbQueryToolBigQuery.validateQuery(q),
              schemaResult
            );
            
            if (refinedQueryResult.validationResult.valid) {
              generatedQuery = refinedQueryResult.query;
              controller.enqueue(createStream("Query refined successfully.", "info"));
            } else {
              // If refinement fails, fall back to a simple query
              generatedQuery = `SELECT * FROM ${tableName} LIMIT 10`;
              controller.enqueue(createStream("Could not refine query. Using fallback query.", "error"));
            }
          }
          
          // Send the final generated query to the client
          const queryGenMessage = formatMessage(
            { content: generatedQuery },
            "query_generated"
          );
          controller.enqueue(createStream(queryGenMessage.data, queryGenMessage.event));

          // Step 5: Execute the validated query
          controller.enqueue(createStream("Executing validated query...", "info"));
          const queryResult = await dbQueryToolBigQuery.invoke({ query: generatedQuery });
          const queryResultMessage = formatMessage(
            { content: queryResult, name: "db_query_tool" },
            "tool_response"
          );
          controller.enqueue(createStream(queryResultMessage.data, queryResultMessage.event));

          // Step 5: Generate final answer
          // Step 5: Generate query explanation
          const queryExplanationResponse = await llm.invoke([
            new SystemMessage(QUERY_EXPLANATION_INSTRUCTION),
            new HumanMessage(`Explain this SQL query: ${generatedQuery}`)
          ]);

          const queryExplanation = queryExplanationResponse.content as string;
          const queryExplanationMessage = formatMessage(
            { content: queryExplanation },
            "query_explanation"
          );
          controller.enqueue(createStream(queryExplanationMessage.data, queryExplanationMessage.event));

          // Step 6: Generate final answer
          const finalAnswerResponse = await llm.invoke([
            new SystemMessage("Based on the query results, provide a clear answer to the user's question. Start your response with 'Answer: '"),
            ...chatHistory,
            new HumanMessage(`Question: ${prompt}\n\nQuery: ${generatedQuery}\n\nQuery Result: ${queryResult}`)
          ]);

          const finalAnswer = finalAnswerResponse.content as string;
          const finalAnswerMessage = formatMessage(
            { content: finalAnswer },
            "final_answer"
          );
          controller.enqueue(createStream(finalAnswerMessage.data, finalAnswerMessage.event));

          // Save the conversation to memory
          await saveToMemory(prompt, finalAnswer, sessionId);

        } catch (error) {
          console.error("Error in SQL agent:", error);
          controller.enqueue(createStream(`Error: ${error instanceof Error ? error.message : String(error)}`, "error"));
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

import { BaseMessage } from "@langchain/core/messages";
import { BufferMemory } from "langchain/memory";

// Create a memory store to maintain conversation history
// This is a simple in-memory store that will be reset when the server restarts
const memoryStore = new Map<string, BufferMemory>();

/**
 * Get or create a memory instance for a session
 */
export function getMemory(sessionId: string = "default"): BufferMemory {
    if (!memoryStore.has(sessionId)) {
        memoryStore.set(
            sessionId,
            new BufferMemory({
                returnMessages: true,
                memoryKey: "chat_history",
                inputKey: "input",
                outputKey: "output",
            })
        );
    }

    return memoryStore.get(sessionId)!;
}

/**
 * Load chat history for a session
 */
export async function loadChatHistory(
    sessionId: string = "default"
): Promise<BaseMessage[]> {
    const memory = getMemory(sessionId);
    const memoryResult = await memory.loadMemoryVariables({});
    return memoryResult.chat_history || [];
}

/**
 * Save a conversation to memory
 */
export async function saveToMemory(
    input: string,
    output: string,
    sessionId: string = "default"
): Promise<void> {
    const memory = getMemory(sessionId);
    await memory.saveContext({ input }, { output });
}

/**
 * Clear memory for a session
 */
export function clearMemory(sessionId: string = "default"): void {
    if (memoryStore.has(sessionId)) {
        memoryStore.delete(sessionId);
    }
}

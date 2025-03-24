import StreamingComponent from "@/components/molecules/streaming/stream-server-response";

export default function Home() {
  return (
    <div className="items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="container mx-auto mb-8">
        <h1 className="text-3xl font-bold tracking-tight">SQL Data Explorer</h1>
        <p className="text-muted-foreground mt-2">
          Ask questions about your data in natural language and get instant insights
        </p>
      </header>
      <main className="flex flex-col gap-[32px] items-center w-full mx-auto container">
        <StreamingComponent />
      </main>
    </div>
  );
}

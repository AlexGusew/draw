import DrawingTool from "@/components/DrawingTool";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold mb-8">Drawing Tool</h1>
      <DrawingTool width={800} height={600} />
    </main>
  );
}

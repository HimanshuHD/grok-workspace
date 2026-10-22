import { createFileRoute } from "@tanstack/react-router";
import { VampApp } from "@/components/vamp/vamp-app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <VampApp />;
}

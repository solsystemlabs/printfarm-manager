import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-2">
      <h3>{"You're a dummy!!!"}</h3>
      <div>Whoa man, try again</div>
    </div>
  );
}

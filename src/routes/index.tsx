import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-2">
      <h3>{"This is great!!!"}</h3>
      <div>Whoa man, try again</div>
    </div>
  );
}

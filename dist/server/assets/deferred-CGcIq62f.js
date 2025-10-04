import { a as reactExports, n as jsxRuntimeExports } from "./worker-entry-D3b-hMU_.js";
import { u as useSuspenseQuery } from "./useSuspenseQuery-D9QtczY3.js";
import { q as queryOptions } from "./router--msQZQ78.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
import "./redaxios.module-Dd5wT7nQ.js";
const deferredQueryOptions = () => queryOptions({
  queryKey: ["deferred"],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 3e3));
    return {
      message: `Hello deferred from the server!`,
      status: "success",
      time: /* @__PURE__ */ new Date()
    };
  }
});
function Deferred() {
  const [count, setCount] = reactExports.useState(0);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: "Loading Middleman...", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DeferredQuery, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Count: ",
      count
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setCount(count + 1), children: "Increment" }) })
  ] });
}
function DeferredQuery() {
  const deferredQuery = useSuspenseQuery(deferredQueryOptions());
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Deferred Query" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Status: ",
      deferredQuery.data.status
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Message: ",
      deferredQuery.data.message
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Time: ",
      deferredQuery.data.time.toISOString()
    ] })
  ] });
}
export {
  Deferred as component
};

import { n as jsxRuntimeExports } from "./worker-entry-D3b-hMU_.js";
import { d as Route, c as postQueryOptions, L as Link } from "./router--msQZQ78.js";
import { u as useSuspenseQuery } from "./useSuspenseQuery-D9QtczY3.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
import "./redaxios.module-Dd5wT7nQ.js";
function PostDeepComponent() {
  const {
    postId
  } = Route.useParams();
  const postQuery = useSuspenseQuery(postQueryOptions(postId));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-2 space-y-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/posts", className: "block py-1 text-blue-800 hover:text-blue-600", children: "← All Posts" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xl font-bold underline", children: postQuery.data.title }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm", children: postQuery.data.body })
  ] });
}
export {
  PostDeepComponent as component
};

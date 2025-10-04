import { n as jsxRuntimeExports, O as Outlet } from "./worker-entry-D3b-hMU_.js";
import { u as useSuspenseQuery } from "./useSuspenseQuery-D9QtczY3.js";
import { p as postsQueryOptions, L as Link } from "./router--msQZQ78.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
import "./redaxios.module-Dd5wT7nQ.js";
function PostsComponent() {
  const postsQuery = useSuspenseQuery(postsQueryOptions());
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-2 flex gap-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "list-disc pl-4", children: [...postsQuery.data, {
      id: "i-do-not-exist",
      title: "Non-existent Post"
    }].map((post) => {
      return /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/posts/$postId", params: {
        postId: post.id
      }, className: "block py-1 text-blue-800 hover:text-blue-600", activeProps: {
        className: "text-black font-bold"
      }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: post.title.substring(0, 20) }) }) }, post.id);
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("hr", {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {})
  ] });
}
export {
  PostsComponent as component
};

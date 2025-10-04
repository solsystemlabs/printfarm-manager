import { n as jsxRuntimeExports, O as Outlet } from "./worker-entry-D3b-hMU_.js";
import { u as useSuspenseQuery } from "./useSuspenseQuery-D9QtczY3.js";
import { u as usersQueryOptions, L as Link } from "./router--msQZQ78.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
import "./redaxios.module-Dd5wT7nQ.js";
function UsersComponent() {
  const usersQuery = useSuspenseQuery(usersQueryOptions());
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-2 flex gap-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "list-disc pl-4", children: [...usersQuery.data, {
      id: "i-do-not-exist",
      name: "Non-existent User",
      email: ""
    }].map((user) => {
      return /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/users/$userId", params: {
        userId: String(user.id)
      }, className: "block py-1 text-blue-800 hover:text-blue-600", activeProps: {
        className: "text-black font-bold"
      }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: user.name }) }) }, user.id);
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("hr", {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {})
  ] });
}
export {
  UsersComponent as component
};

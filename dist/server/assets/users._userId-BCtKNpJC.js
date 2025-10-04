import { n as jsxRuntimeExports } from "./worker-entry-D3b-hMU_.js";
import { u as useSuspenseQuery } from "./useSuspenseQuery-D9QtczY3.js";
import { R as Route, a as userQueryOptions } from "./router--msQZQ78.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
import "./redaxios.module-Dd5wT7nQ.js";
function UserComponent() {
  const params = Route.useParams();
  const userQuery = useSuspenseQuery(userQueryOptions(params.userId));
  const user = userQuery.data;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xl font-bold underline", children: user.name }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm", children: user.email })
  ] });
}
export {
  UserComponent as component
};

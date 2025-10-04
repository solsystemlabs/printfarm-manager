import { n as jsxRuntimeExports, O as Outlet } from "./worker-entry-D3b-hMU_.js";
import { L as Link } from "./router--msQZQ78.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
import "./redaxios.module-Dd5wT7nQ.js";
function PathlessLayoutComponent() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "I'm a nested pathless layout" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/route-a", activeProps: {
        className: "font-bold"
      }, children: "Go to route A" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/route-b", activeProps: {
        className: "font-bold"
      }, children: "Go to route B" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) })
  ] });
}
export {
  PathlessLayoutComponent as component
};

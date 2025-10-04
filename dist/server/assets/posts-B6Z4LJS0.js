import { x as createServerRpc, v as createServerFn, y as notFound } from "./worker-entry-D3b-hMU_.js";
import { a as axios } from "./redaxios.module-Dd5wT7nQ.js";
import "node:events";
import "node:stream";
import "node:async_hooks";
import "node:stream/web";
const fetchPosts_createServerFn_handler = createServerRpc("src_utils_posts_tsx--fetchPosts_createServerFn_handler", (opts, signal) => {
  return fetchPosts.__executeServer(opts, signal);
});
const fetchPost_createServerFn_handler = createServerRpc("src_utils_posts_tsx--fetchPost_createServerFn_handler", (opts, signal) => {
  return fetchPost.__executeServer(opts, signal);
});
const fetchPosts = createServerFn({
  method: "GET"
}).handler(fetchPosts_createServerFn_handler, async () => {
  console.info("Fetching posts...");
  return axios.get("https://jsonplaceholder.typicode.com/posts").then((r) => r.data.slice(0, 10));
});
const fetchPost = createServerFn({
  method: "GET"
}).inputValidator((d) => d).handler(fetchPost_createServerFn_handler, async ({
  data
}) => {
  console.info(`Fetching post with id ${data}...`);
  const post = await axios.get(`https://jsonplaceholder.typicode.com/posts/${data}`).then((r) => r.data).catch((err) => {
    console.error(err);
    if (err.status === 404) {
      throw notFound();
    }
    throw err;
  });
  return post;
});
export {
  fetchPost_createServerFn_handler,
  fetchPosts_createServerFn_handler
};

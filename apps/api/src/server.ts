import { createServer } from "node:http";
import { apiManifest } from "./manifest.js";
import { handleRequest } from "./router.js";

const port = Number(process.env.CACSMS_API_PORT ?? 3019);

createServer((request, response) => {
  void handleRequest(request, response);
}).listen(port, () => {
  console.log(`CACSMS API listening on http://127.0.0.1:${port}`);
  console.log(JSON.stringify({ modules: apiManifest.modules.length, contentTypes: apiManifest.contentTypes.length }, null, 2));
});

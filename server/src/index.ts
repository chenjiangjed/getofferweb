import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.port, () => {
  console.info(`chujobfinder server listening on http://localhost:${config.port}`);
});

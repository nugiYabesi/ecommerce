import "dotenv/config";
import app from "./app";
import { closeDatabase, connectDatabase } from "./config/db";

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    console.log("Database connected successfully");
    const port = Number(process.env.PORT || 5000);
    const server = app.listen(port, () => console.log(`Server running on port ${port}`));
    const shutdown = async () => {
      server.close(async () => {
        await closeDatabase();
        process.exit(0);
      });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Database connection failed. Server was not started.", error);
    await closeDatabase();
    process.exit(1);
  }
}

void startServer();

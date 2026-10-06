import express, { ErrorRequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/productRoutes";
import swaggerDocument from "./swagger";

const app = express();
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/api/health", (_request, response) => response.json({ message: "E-Commerce API is running" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

app.use((_request, response) => response.status(404).json({ message: "Route not found" }));

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof Error && (error.name === "MulterError" || error.message === "Only image files are allowed")) {
    response.status(400).json({ message: error.message });
    return;
  }
  console.error("Unexpected request error:", error);
  response.status(500).json({ message: "Internal server error" });
};
app.use(errorHandler);

export default app;

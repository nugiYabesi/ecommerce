import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: { title: "Simple E-Commerce API", version: "1.0.0", description: "Beginner-friendly e-commerce REST API" },
    servers: [{ url: "http://localhost:5000" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        User: { type: "object", properties: { id: { type: "string", example: "507f1f77bcf86cd799439011" }, name: { type: "string" }, email: { type: "string" } } },
        Product: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" }, name: { type: "string" }, category: { type: "string" },
            price: { type: "number" }, quantity: { type: "integer" }, description: { type: "string", nullable: true },
            image_url: { type: "string", nullable: true }, image_public_id: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    paths: {
      "/api/health": { get: { summary: "Check API status", responses: { "200": { description: "API is running" } } } },
      "/api/auth/register": {
        post: {
          summary: "Register a user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } } } } },
          responses: { "201": { description: "User registered; response says whether the welcome email was sent" }, "400": { description: "Invalid input" }, "409": { description: "Email already registered" } },
        },
      },
      "/api/auth/login": {
        post: {
          summary: "Start login and email a verification code",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } } } } },
          responses: { "200": { description: "Verification code sent; response includes challengeId" }, "401": { description: "Invalid credentials" }, "500": { description: "Email service is unavailable" } },
        },
      },
      "/api/auth/login/verify": {
        post: {
          summary: "Verify the emailed login code and receive a JWT",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["challengeId", "code"], properties: { challengeId: { type: "string", example: "507f1f77bcf86cd799439011" }, code: { type: "string", pattern: "^\\d{6}$" } } } } } },
          responses: { "200": { description: "Login verified; response includes the JWT" }, "401": { description: "Invalid or expired code" }, "429": { description: "Too many attempts" } },
        },
      },
      "/api/auth/account": {
        delete: {
          summary: "Delete your own account",
          description: "Permanently deletes the signed-in user's account after checking the email code.",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "code"], properties: { email: { type: "string", format: "email" }, code: { type: "string", pattern: "^\\d{6}$", description: "The six-digit code emailed to you" } } } } } },
          responses: {
            "200": { description: "Your account was deleted successfully" },
            "400": { description: "Email or code is missing or does not match your account" },
            "401": { description: "Please log in first, or the code is invalid or expired" },
            "404": { description: "User account not found" },
            "429": { description: "Too many code attempts" },
            "500": { description: "Unable to delete your account" },
          },
        },
      },
      "/api/auth/account/delete-code": {
        post: {
          summary: "Email yourself an account deletion code",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } } },
          responses: {
            "200": { description: "Deletion code sent; it expires in 10 minutes" },
            "400": { description: "Email is invalid or does not match your account" },
            "401": { description: "Please log in first" },
          },
        },
      },
      "/api/products": {
        get: { summary: "List products", security: [{ bearerAuth: [] }], responses: { "200": { description: "Product list" }, "401": { description: "Unauthorized" } } },
        post: {
          summary: "Create a product with an optional image",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["name", "category", "price"], properties: { name: { type: "string" }, category: { type: "string" }, price: { type: "number", minimum: 0 }, quantity: { type: "integer", minimum: 0 }, description: { type: "string" }, image: { type: "string", format: "binary" } } } } } },
          responses: { "201": { description: "Product created" }, "400": { description: "Invalid input" }, "401": { description: "Unauthorized" } },
        },
      },
      "/api/products/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }],
        get: { summary: "Get a product", security: [{ bearerAuth: [] }], responses: { "200": { description: "Product found" }, "404": { description: "Product not found" } } },
        put: {
          summary: "Update product fields and optionally replace its image",
          security: [{ bearerAuth: [] }],
          requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, price: { type: "number", minimum: 0 }, quantity: { type: "integer", minimum: 0 }, description: { type: "string" }, image: { type: "string", format: "binary" } } } } } },
          responses: { "200": { description: "Product updated" }, "400": { description: "Invalid input" }, "404": { description: "Product not found" } },
        },
        delete: { summary: "Delete a product and its Cloudinary image", security: [{ bearerAuth: [] }], responses: { "200": { description: "Product deleted" }, "404": { description: "Product not found" } } },
      },
    },
  },
  apis: [],
};

export default swaggerJsdoc(options);

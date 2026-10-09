# Simple E-Commerce API

A beginner-friendly REST API built with Node.js, Express, TypeScript, MongoDB Atlas, JWT, bcrypt, Multer, and Cloudinary. Users can register and log in, then manage products through authenticated endpoints.

## Technologies

- **Node.js** runs the server-side JavaScript environment.
- **TypeScript** adds types that make the code easier to understand and maintain.
- **Express** defines the API routes and middleware.
- **MongoDB Atlas** stores users and product documents.
- **Mongoose** connects to MongoDB Atlas and defines schemas and models for application data.
- **bcrypt** hashes passwords before they are stored.
- **jsonwebtoken** creates and checks login tokens.
- **Multer** accepts product images in memory.
- **Cloudinary** stores uploaded product images.
- **Swagger UI** provides interactive API documentation.
- **Nodemon** restarts the development server when files change.

## Installation

```bash
npm.cmd install
```

## Environment variables

Set `MONGODB_URI` to your MongoDB Atlas connection string, `MONGODB_DB_NAME` to your database name (for example, `ecommerce`), a long random `JWT_SECRET`, your Cloudinary account credentials, and `BREVO_API_KEY` plus a verified `BREVO_SENDER_EMAIL`. `.env` is ignored by Git; keep the Brevo key private. Atlas connection strings include your database username and password; URL-encode special characters in the password and allow your server IP in Atlas Network Access.

## Database setup

Create an Atlas cluster and database user, then set the connection string in `MONGODB_URI`. The API creates the `users` and `products` collections on first use and creates a unique index for user email addresses at startup.

## Running

```bash
npm.cmd run dev
```

The server checks the MongoDB connection before it starts. The health endpoint is `http://localhost:5000/api/health`.

## Build

```bash
npm.cmd run build
npm.cmd start
```

## API documentation

Open [http://localhost:5000/api-docs](http://localhost:5000/api-docs). Start login, enter the code sent to the user's email in `/api/auth/login/verify`, then copy the returned JWT, click **Authorize**, and enter the token. Swagger sends it as a Bearer token.

## Endpoints

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a user and send a welcome email |
| POST | `/api/auth/login` | Public | Check password and email a one-time login code |
| POST | `/api/auth/login/verify` | Public | Verify the code and get a JWT |
| POST | `/api/products` | JWT required | Create a product; accepts multipart form data and optional `image` |
| GET | `/api/products` | JWT required | List products |
| GET | `/api/products/:id` | JWT required | Get one product |
| PUT | `/api/products/:id` | JWT required | Update a product; optional replacement `image` |
| DELETE | `/api/products/:id` | JWT required | Delete a product and its image |
| GET | `/api/health` | Public | Check API status |

Product image uploads use `multipart/form-data`; text fields are `name`, `category`, `price`, `quantity`, and `description`, with the file field named `image`.

## Authentication flow

```text
Register
   ↓
Password hashed with bcrypt
   ↓
Login with email and password
   ↓
Six-digit code emailed through Brevo (expires in 10 minutes), then submitted with challengeId to `/api/auth/login/verify`
JWT generated
   ↓
JWT sent with requests
   ↓
Middleware verifies JWT
   ↓
Protected product routes
```

## Image flow

```text
Client
   ↓
Multer
   ↓
Cloudinary
   ↓
Image URL + Public ID
   ↓
PostgreSQL
```

MongoDB Atlas stores the Cloudinary image URL and public ID, not the image file. Product IDs are MongoDB ObjectId strings. Replacing or deleting a product image also removes its Cloudinary asset.

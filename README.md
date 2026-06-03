# StarForge

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-A91E50?style=for-the-badge&logo=ejs&logoColor=white)
![Passport.js](https://img.shields.io/badge/Passport.js-34E27A?style=for-the-badge&logo=passport&logoColor=white)
![Multer](https://img.shields.io/badge/Multer-F75900?style=for-the-badge&logo=multer&logoColor=white)
![Nodemailer](https://img.shields.io/badge/Nodemailer-007ACC?style=for-the-badge&logo=nodemailer&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)
![Sharp](https://img.shields.io/badge/Sharp-000000?style=for-the-badge&logo=sharp&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)

## Overview

StarForge is a robust full-stack web application engineered with Node.js and the Express.js framework, utilizing MongoDB for persistent data storage via Mongoose. The application integrates a comprehensive suite of functionalities including secure user authentication (Passport.js with Google OAuth20 and bcrypt), efficient file uploads (Multer), dynamic email notifications (Nodemailer), and integrated payment processing through Razorpay. Advanced features encompass data export capabilities (ExcelJS, json2csv), image manipulation (Sharp), and browser automation (Puppeteer), all presented through an interactive user interface rendered with EJS templates.

## System Architecture

The project adheres to a modular architecture, organizing functionalities into distinct directories to promote maintainability and scalability:

*   **`app.js`**: The primary entry point of the application, responsible for initializing the Express server, establishing database connections, and registering global middleware and routes.
*   **`config/`**: Contains configuration files for various services, including database connection strings, API keys, and environment-specific settings.
*   **`controllers/`**: Encapsulates the core business logic, handling incoming requests, interacting with models, and preparing data for view rendering or API responses.
*   **`middlewares/`**: Houses custom Express middleware functions for cross-cutting concerns such as authentication, authorization, session management, and error handling.
*   **`models/`**: Defines Mongoose schemas and models, representing the application's data structure and facilitating object-document mapping for MongoDB interactions.
*   **`public/`**: Stores static assets including CSS stylesheets, client-side JavaScript files, and images, which are served directly to the browser.
*   **`routes/`**: Manages the application's API endpoints and URL routing logic, directing incoming HTTP requests to the appropriate controller functions.
*   **`scripts/`**: Contains standalone utility scripts for various operational tasks, such as database seeding, data migration, or scheduled background processes.
*   **`util/`**: Provides general-purpose utility functions and helper modules designed to be reused across different components of the application.
*   **`views/`**: Contains EJS template files responsible for rendering dynamic HTML content and constructing the user interface presented to clients.

## Prerequisites

Before setting up and running StarForge, ensure the following software is installed on your system:

*   **Node.js**: Version 18.x or higher (LTS recommended).
*   **npm**: Node Package Manager, which is bundled with Node.js.
*   **MongoDB**: A running instance of MongoDB, accessible either locally or remotely.

## Installation

Follow these steps to set up the StarForge project locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/MuhammedFaazCC/StarForge.git
    ```
2.  **Navigate to the project directory**:
    ```bash
    cd StarForge
    ```
3.  **Install project dependencies**:
    ```bash
    npm install
    ```
4.  **Configure Environment Variables**:
    Create a `.env` file in the root directory of the project. This file will store sensitive information and configuration settings. Populate it with necessary variables such as:
    *   `PORT` (e.g., `3000`)
    *   `MONGODB_URI` (e.g., `mongodb://localhost:27017/starforge_db`)
    *   `SESSION_SECRET` (A strong, random string for Express sessions)
    *   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for Google OAuth)
    *   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (for Razorpay payments)
    *   `NODEMAILER_USER`, `NODEMAILER_PASS` (for email service credentials)
    *   Any other API keys or secrets required by the application.

## Usage

To run the StarForge application after installation and configuration:

1.  **Ensure MongoDB is running** and accessible at the `MONGODB_URI` specified in your `.env` file.
2.  **Start the application**:
    ```bash
    npm start
    ```
    This command utilizes `nodemon` (as configured in `package.json`) to automatically restart the server upon file changes during development.
3.  **Access the application**:
    Open your web browser and navigate to the address specified by your `PORT` environment variable (e.g., `http://localhost:3000`).

<br/><br/>_Generated by [Auto-README](https://auto-readme-livid.vercel.app/)_

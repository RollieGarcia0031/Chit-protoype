# Deploying Your Next.js App to Vercel

This guide provides steps to deploy your Next.js application, which includes Firebase and Genkit (Gemini AI) functionalities, to Vercel.

## Prerequisites

1.  **Vercel Account**: Ensure you have a Vercel account. You can sign up at [vercel.com](https://vercel.com).
2.  **Git Repository**: Your project code should be in a Git repository (e.g., GitHub, GitLab, Bitbucket).
3.  **Firebase Project**: Your Firebase project should be set up, and you should have your Firebase configuration keys.
4.  **Google AI API Key**: You'll need an API key for Google AI Studio (Gemini) for the Genkit features to work. You can get this from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Deployment Steps

1.  **Push Your Code to Git**:
    Make sure all your latest changes are committed and pushed to your Git repository. A `.gitignore` file has been added to your project to help exclude unnecessary files like `node_modules` and local environment files.

2.  **Import Project on Vercel**:
    *   Log in to your Vercel dashboard.
    *   Click on "Add New..." and select "Project".
    *   Import your Git repository. Vercel will automatically detect that it's a Next.js project.

3.  **Configure Project Settings (Environment Variables)**:
    This is a crucial step for your Firebase and Genkit AI features to function correctly.
    *   In your Vercel project settings, navigate to "Environment Variables".
    *   Add the following variables:

        *   **Firebase Configuration**:
            Your Firebase client-side configuration keys are currently in the `.env` file (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`). If this file is committed to your repository, Vercel will automatically pick them up. However, for best practice or if your `.env` file is gitignored, add them here:
            *   `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase API Key
            *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Your Firebase Auth Domain
            *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Your Firebase Project ID
            *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase Storage Bucket
            *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase Messaging Sender ID
            *   `NEXT_PUBLIC_FIREBASE_APP_ID`: Your Firebase App ID

        *   **Genkit Google AI (Gemini) API Key**:
            This key is required for the AI features and should be treated as a secret. The `@genkit-ai/googleai` plugin typically looks for `GEMINI_API_KEY`.
            *   `GEMINI_API_KEY`: Your Google AI Studio API Key.

    *   Ensure you set these variables for all relevant environments (Production, Preview, Development).

4.  **Deploy**:
    *   After configuring the environment variables, click the "Deploy" button on Vercel (or trigger a deployment by pushing to your main branch if CI/CD is set up).
    *   Vercel will build your Next.js application and deploy it. The build process will use the `build` script from your `package.json` (`next build`).
    *   You'll receive a unique URL for your deployed application.

5.  **Verify Firebase Setup**:
    *   **Authentication**: Ensure your Firebase Authentication authorized domains include your Vercel deployment URL (e.g., `your-app-name.vercel.app`). You can add this in the Firebase console under Authentication -> Settings -> Authorized domains.
    *   **Firestore Rules**: Review your Firestore security rules to ensure they allow access from your deployed application as intended.

## Genkit on Vercel

Genkit flows in this application are defined as server-side code. Vercel's serverless functions environment is well-suited for running these Next.js API routes or Server Actions that utilize Genkit.

Ensure the `GEMINI_API_KEY` is correctly set in Vercel's environment variables, as this is essential for `ai.generate()` calls using the `googleAI()` plugin to succeed.

## Troubleshooting

*   **Build Errors**: Check the build logs on Vercel for any errors. Common issues include missing dependencies or incorrect environment variable setup.
*   **Runtime Errors**: Use Vercel's runtime logs to diagnose issues with your serverless functions (which handle API routes and Server Actions).
*   **AI Features Not Working**: This is most likely due to a missing or incorrect `GEMINI_API_KEY`. Double-check the environment variable in Vercel.
*   **Firebase Issues**: Verify authorized domains and Firestore security rules in your Firebase project console.

By following these steps, you should be able to successfully deploy your application to Vercel.
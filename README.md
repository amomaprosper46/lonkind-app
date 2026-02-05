# Lonkind - A Next.js & Firebase Social App

This is a Next.js application built with Firebase, featuring real-time social interactions, AI-powered content generation, and more.

## Getting Started

First, install the dependencies:
```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.


## Key Features

*   **Authentication:** Secure sign-up and sign-in using Firebase Authentication.
*   **Real-time Feed:** A live feed of posts from users you follow.
*   **Friendship Model:** Send and accept friend requests for a mutual connection.
*   **Rich Profiles:** Customizable user profiles with bios, avatars, and detailed "About" sections.
*   **AI Content Tools (Admin):**
    *   **News Bot:** Automatically generate and post news articles to the main feed.
    *   **AI Assistant:** A conversational AI to answer questions.
    *   **App Statistics:** A real-time view of the total user count.

## Deploying Your Application

There are several great options for deploying a Next.js application. Below are instructions for two of the most popular and effective choices: Vercel and Firebase Hosting.

---

### Option 1: Deploying with Vercel (Recommended for Next.js)

Vercel is the company behind Next.js, and their hosting platform is optimized for the best performance and easiest setup. Their free tier fully supports all features of this application without requiring a credit card. **This is the recommended approach.**

#### Prerequisites
1.  **GitHub/GitLab/Bitbucket Account:** Your code should be in a repository on one of these services.
2.  **Vercel Account:** Sign up for a free Vercel account at [vercel.com](https://vercel.com).

#### Deployment Steps
1.  **Create a New Vercel Project:** After logging into your Vercel account, click the "Add New... > Project" button.
2.  **Import Your Git Repository:** Vercel will ask you to connect your Git provider. Find and select the repository for this project.
3.  **Configure the Project:** Vercel automatically detects that this is a Next.js project and sets the build commands for you. You do not need to change any settings.
4.  **Add Environment Variables:** This is the most important step. Your app needs to connect to Firebase.
    *   Go to your Firebase project console.
    *   Click the gear icon > **Project settings**.
    *   In the "Your apps" card, find your web app and click the "SDK setup and configuration" button (or select "Config").
    *   You will see a `firebaseConfig` object with several key-value pairs.
    *   Now, in your Vercel project settings, go to the "Environment Variables" section.
    *   Create a new environment variable for each key from your `firebaseConfig` object, prefixing the name with `NEXT_PUBLIC_`. For example, for `apiKey: "value"`, you will create a variable named `NEXT_PUBLIC_FIREBASE_API_KEY` with the `"value"`.
    *   You must create variables for all the keys in your configuration object.
5.  **Deploy!** Click the "Deploy" button. Vercel will build your application and deploy it. Once finished, it will provide you with a live URL.

From now on, every time you push a change to your main branch in GitHub, Vercel will automatically redeploy the new version of your app!

---

### Option 2: Deploying to Firebase Hosting

**Important Requirement:** This deployment method requires your Firebase project to be on the **Blaze (pay-as-you-go) plan**. The free "Spark" plan does not support the necessary Cloud Functions for a Next.js application. While the Blaze plan has a generous free tier, it requires a billing account to be set up. For a free and simpler deployment, we strongly recommend using Vercel (Option 1).

This is also a great option because it keeps your application and your backend services on the same platform. This project is set up for **Server-Side Rendering (SSR) on Firebase**.

#### Prerequisites

1.  **Node.js:** Make sure you have Node.js installed on your machine.
2.  **Firebase Account:** You will need a Firebase account and have created the "impactful-ideas" project.
3.  **Firebase CLI:** Install the Firebase command-line tools globally:
    ```bash
    npm install -g firebase-tools
    ```

#### Deployment Steps

1.  **Login to Firebase:**
    ```bash
    firebase login
    ```
    This will open a browser window for you to log in to your Google account.

2.  **Initialize Firebase (if you haven't already):**
    If this is your first time deploying from this project, run `firebase init` and select **Hosting** and **Functions**. Follow the prompts, but the `firebase.json` file in this project is already configured for you.

3.  **Build and Deploy:**
    The deploy script in `package.json` handles both building and deploying.
    ```bash
    npm run deploy
    ```

After the command finishes, it will give you a URL where your live application can be viewed. That's it! Your app will be live on the internet.

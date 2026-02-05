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

Vercel is the company behind Next.js, and their hosting platform is optimized for the best performance and easiest setup. This is the recommended approach.

#### Prerequisites
1.  **GitHub/GitLab/Bitbucket Account:** Your code should be in a repository on one of these services.
2.  **Vercel Account:** Sign up for a free Vercel account at [vercel.com](https://vercel.com).

#### Deployment Steps
1.  **Create a New Vercel Project:** After logging into your Vercel account, click the "Add New... > Project" button.
2.  **Import Your Git Repository:** Vercel will ask you to connect your Git provider. Find and select the repository for this project.
3.  **Configure the Project:** Vercel automatically detects that this is a Next.js project and sets the build commands for you. You do not need to change any settings.
4.  **Add Environment Variables:** This is the most important step. Your app needs to connect to Firebase. In the Vercel project settings, go to the "Environment Variables" section. You need to add all the values from your Firebase configuration. Create a new variable for each of the following keys from your `src/lib/firebase.ts` file:
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
5.  **Deploy!** Click the "Deploy" button. Vercel will build your application and deploy it. Once finished, it will provide you with a live URL.

From now on, every time you push a change to your main branch in GitHub, Vercel will automatically redeploy the new version of your app!

---

### Option 2: Deploying to Firebase Hosting

This is also a great option because it keeps your application and your backend services on the same platform.

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

2.  **Initialize Firebase Hosting:**
    If you haven't already, you need to initialize hosting in your project directory. Run:
    ```bash
    firebase init hosting
    ```
    When prompted:
    - Select **Use an existing project** and choose `impactful-ideas`.
    - For your public directory, enter **`.next`**. (This is where Next.js puts the production build).
    - Configure as a single-page app? **Yes**.
    - Set up automatic builds and deploys with GitHub? **No** (You can set this up later if you wish).

3.  **Build the Project:**
    Create a production-ready build of your Next.js application:
    ```bash
    npm run build
    ```

4.  **Deploy!**
    After the build is complete, deploy the app to Firebase Hosting:
    ```bash
    firebase deploy --only hosting
    ```

After the command finishes, it will give you a URL where your live application can be viewed. That's it! Your app will be live on the internet.
"# lonkin" 

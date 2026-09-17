# Firebase Setup Guide

Your web app has been successfully configured to use Firebase for authentication and data persistence. Follow these steps to complete the setup:

## 1. Configure Your Firebase Project

You mentioned you already created a Firebase project. Now you need to:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**
3. **Add a web app**:
   - Click "Add app" and select Web (</>) 
   - Register your app with a nickname
   - Copy the configuration object

## 2. Update Firebase Configuration

Replace the placeholder values in `firebase.config.ts` with your actual Firebase project configuration:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com", 
  projectId: "your-actual-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-actual-app-id"
};
```

## 3. Enable Authentication

1. In Firebase Console, go to **Authentication** > **Get started**
2. Go to **Sign-in method** tab
3. Enable **Email/Password** authentication
4. Click **Save**

## 4. Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database** > **Create database**
2. Choose **Start in test mode** (you can secure it later)
3. Select a location for your database
4. Click **Done**

## 5. Configure Firestore Security Rules

Go to **Firestore Database** > **Rules** and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Evaluations: users can read/write their own, admins can read all
    match /evaluations/{evalId} {
      allow read, write: if request.auth != null && 
        (resource.data.userEmail == request.auth.token.email || 
         request.auth.token.email == 'rpakzad@taraazresearch.org');
      allow create: if request.auth != null;
    }

    // Access requests: anyone can submit a request (no account needed yet),
    // but only the admin can read/review/update them. `create` is shape-checked
    // so a submission can only ever land as {email, purpose, status: 'pending'}.
    match /accessRequests/{requestId} {
      allow create: if request.resource.data.email is string &&
                       request.resource.data.email.size() < 200 &&
                       request.resource.data.purpose is string &&
                       request.resource.data.purpose.size() < 1000 &&
                       request.resource.data.status == 'pending';
      allow read, update, delete: if request.auth != null &&
        request.auth.token.email == 'rpakzad@taraazresearch.org';
    }
  }
}
```

Note: the first time you open the admin "Access Requests" panel, Firestore will
likely show a console error with a link to auto-create the composite index it
needs (status + createdAt) — click that link once and the query will work from
then on.

## 6. Test the Setup

1. Run your development server: `npm run dev`
2. Try creating a new account with the sign-up form
3. Log in and create an evaluation
4. Log out and log back in to verify data persistence
5. Check the Firestore Console to see your data

## What Has Been Implemented

✅ **Firebase SDK**: Installed and configured
✅ **Authentication**: Email/password with automatic role assignment
✅ **Database Migration**: Converted from localStorage to Firestore
✅ **Data Persistence**: Evaluations now sync across devices and browsers
✅ **User Management**: Automatic user profile creation
✅ **Security**: Role-based access (admin vs evaluator)

## Key Features

- **Cross-device sync**: Users can access their evaluations from any browser
- **Secure authentication**: Proper email/password authentication
- **Role-based access**: Admin users see all evaluations, evaluators see only their own
- **Real-time data**: Changes are immediately saved to the cloud
- **Offline capability**: Firebase provides automatic offline support

Your app now has a proper backend with persistent storage!

## 7. Access Requests (replaces public self-signup)

The login screen no longer lets visitors create their own account. Instead:

1. A visitor clicks **Request Access**, enters their email and a short note
   on intended use. This is saved to a new `accessRequests` Firestore
   collection (rule above) — no account or sign-in required to submit.
2. You (the admin) log in and click **Access Requests** in the header (or
   lobby screen) to see pending requests, and **Approve** or **Reject** each
   one.
3. **Approve** auto-generates a random temp password, creates the Firebase
   Auth account + Firestore profile for them (via a throwaway secondary
   Firebase app instance, so you stay logged in as yourself), and — if
   EmailJS is configured (see below) — emails them the temp password.
4. The new user signs in with the temp password, then can change it via
   **Change Password** in the header/lobby screen.

### Configuring email notifications (EmailJS)

Two emails are sent, both optional (the app works without them — you can
always just check the Access Requests panel):

- **To you**, when someone submits a request.
- **To the new user**, when you approve their request (their temp password).

To enable them:

1. Create a free account at [emailjs.com](https://www.emailjs.com) and
   connect an email service (e.g. Gmail) to send from.
2. Create two templates:
   - A "new request" template using `{{requester_email}}` and `{{purpose}}`,
     sent to `rpakzad@taraazresearch.org`.
   - An "approved" template using `{{to_email}}` and `{{temp_password}}`,
     sent to the new user.
3. In `services/emailService.ts`, replace the four placeholder constants
   (`EMAILJS_SERVICE_ID`, `EMAILJS_NEW_REQUEST_TEMPLATE_ID`,
   `EMAILJS_APPROVED_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`) with the values from
   your EmailJS dashboard (Account > General).

Until you do this, requests still land in Firestore and show up in the
Access Requests panel — only the emails are skipped.

### A security caveat worth knowing

Removing the sign-up button stops casual/opportunistic self-registration,
but it isn't a hard security boundary: Firebase's client API key is meant to
be public (it's embedded in the browser bundle by design), so a determined
user could still call Firebase's Auth REST API directly to create an
account, bypassing the UI entirely. This is a general Firebase limitation —
there's no native "sign-in only, no self sign-up" toggle for the
Email/Password provider. If you want a harder guarantee later, the standard
mitigation is [Firebase App Check](https://firebase.google.com/docs/app-check),
which requires requests to come from your actual app before Firebase Auth
will honor them. Not implemented here to keep this change scoped, but worth
adding if the donate button doesn't keep costs in check on its own.
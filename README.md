# AptPilot Connect

Create a responsive full-stack web application named AptPilot.

AptPilot is a smart apartment-building management platform for Bangladesh.

It digitises the work of a building manager and connects three user roles:

1. Owner

2. Manager

3. Tenant

Use React, TypeScript, Vite and Tailwind CSS.

Use Supabase as the backend for:

- Authentication

- PostgreSQL database

- File storage

- Row Level Security

Approved visual direction:

- Warm, minimal and professional dashboard design

- Rounded but not overly playful cards

- Clear tables and forms

- Responsive desktop and mobile layouts

- No navy-blue theme

- No gradients unless extremely subtle

Use this colour system based on our approved design reference:

Primary dark text and navigation: #2E2A3B

Secondary text: #7A7387

Primary sage green: #5E8C6A

Light sage background: #CFE0D3

Warm peach: #F6C7A9

Burnt orange: #D97B45

Pale lavender: #DCD6EC

Muted rose: #B5697A

Main background: #FDF8F4

Secondary card background: #F7EFE8

Border colour: #C9BDB2

White: #FFFFFF

Create reusable global theme variables so every future page uses this same

design system.

For this first step, create only:

1. Public landing page

2. Login page

3. Registration page

4. Protected Owner Dashboard placeholder

5. Protected Manager Dashboard placeholder

6. Protected Tenant Dashboard placeholder

7. Shared responsive navigation

8. Profile menu and logout button

Registration fields:

- Full name

- Email

- Phone number

- Password

- Confirm password

- Role: Owner, Manager or Tenant

Connect registration and login to real Supabase Authentication.

Create a profiles table connected to auth.users with:

- id

- full_name

- email

- phone

- role

- created_at

After login:

- Owner goes to /owner/dashboard

- Manager goes to /manager/dashboard

- Tenant goes to /tenant/dashboard

Apply secure Row Level Security so users can read and update only their own

profile.

Do not create buildings, flats, bills, payments, expenses, repairs or AI

features yet.

Do not use fake authentication.

Do not display fake dashboard statistics.

Do not create buttons that have no working action.

Do not change or remove the Supabase connection.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flatmate-central.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7724534e-17ce-498b-93c0-64580025b218).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
